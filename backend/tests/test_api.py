import uuid

from conftest import ALICE, BOB, CAROL, HENRY, login


def _direct(client, headers, user_id):
    return client.post("/api/conversations/direct", json={"user_id": user_id}, headers=headers).json()


def _send(client, headers, conversation_id, body):
    return client.post(
        f"/api/conversations/{conversation_id}/messages",
        json={"body": body, "client_id": uuid.uuid4().hex},
        headers=headers,
    )


def _next_event(ws, event_type):
    while True:
        event = ws.receive_json()
        if event["type"] == event_type:
            return event


def test_otp_rejects_wrong_code(client):
    assert client.post("/api/auth/verify", json={"phone": ALICE, "code": "000000"}).status_code == 400


def test_new_number_registers_and_needs_profile(client):
    headers, body = login(client, "+447700900123")
    assert body["is_new_user"] is True
    response = client.patch("/api/users/me", json={"display_name": "Zoe", "avatar_color": "A140"}, headers=headers)
    assert response.json()["display_name"] == "Zoe"
    _, again = login(client, "+447700900123")
    assert again["is_new_user"] is False


def test_logout_invalidates_session(client):
    headers, _ = login(client, CAROL)
    assert client.post("/api/auth/logout", headers=headers).status_code == 204
    assert client.get("/api/users/me", headers=headers).status_code == 401


def test_seeded_conversations_sorted_with_unread(client):
    headers, _ = login(client, ALICE)
    conversations = client.get("/api/conversations", headers=headers).json()
    activity = [c["last_activity_at"] for c in conversations]
    assert activity == sorted(activity, reverse=True)
    assert any(c["unread_count"] > 0 for c in conversations)


def test_seeded_timelines_are_chronological(client):
    headers, _ = login(client, ALICE)
    for conversation in client.get("/api/conversations", headers=headers).json():
        page = client.get(f"/api/conversations/{conversation['id']}/messages", headers=headers).json()
        times = [m["created_at"] for m in page["messages"]]
        assert times == sorted(times), conversation["id"]


def test_add_contact_by_phone(client):
    headers, _ = login(client, ALICE)
    henry = client.get("/api/users/lookup", params={"q": HENRY}, headers=headers).json()
    assert client.post("/api/contacts", json={"user_id": henry["id"]}, headers=headers).status_code == 201
    assert henry["id"] in [u["id"] for u in client.get("/api/contacts", headers=headers).json()]


def test_realtime_message_delivery_and_read_receipts(client):
    alice_headers, alice = login(client, ALICE)
    bob_headers, bob = login(client, BOB)
    conversation = _direct(client, alice_headers, bob["user"]["id"])

    with client.websocket_connect(f"/ws?token={alice_headers['Authorization'][7:]}") as alice_ws, \
            client.websocket_connect(f"/ws?token={bob_headers['Authorization'][7:]}") as bob_ws:
        sent = _send(client, alice_headers, conversation["id"], "Hello Bob").json()
        assert sent["status"] == "sent"

        received = _next_event(bob_ws, "message.new")
        assert received["message"]["body"] == "Hello Bob"

        bob_ws.send_json({"type": "delivered", "message_ids": [sent["id"]]})
        update = _next_event(alice_ws, "message.status")
        assert update["updates"][0] == {
            "message_id": sent["id"], "conversation_id": conversation["id"], "status": "delivered"
        }

        client.post(f"/api/conversations/{conversation['id']}/read", headers=bob_headers)
        update = _next_event(alice_ws, "message.status")
        assert update["updates"][0]["status"] == "read"

        bob_ws.send_json({"type": "typing", "conversation_id": conversation["id"], "is_typing": True})
        typing = _next_event(alice_ws, "typing")
        assert typing["user_id"] == bob["user"]["id"] and typing["is_typing"] is True


def test_send_is_idempotent_per_client_id(client):
    headers, _ = login(client, ALICE)
    _, bob = login(client, BOB)
    conversation = _direct(client, headers, bob["user"]["id"])
    payload = {"body": "only once", "client_id": "fixed-client-id"}
    first = client.post(f"/api/conversations/{conversation['id']}/messages", json=payload, headers=headers).json()
    second = client.post(f"/api/conversations/{conversation['id']}/messages", json=payload, headers=headers).json()
    assert first["id"] == second["id"]


def test_group_admin_controls(client):
    alice_headers, _ = login(client, ALICE)
    bob_headers, bob = login(client, BOB)
    _, carol = login(client, CAROL)
    group = client.post(
        "/api/conversations/groups",
        json={"title": "Test group", "member_ids": [bob["user"]["id"]]},
        headers=alice_headers,
    ).json()
    assert group["my_role"] == "admin"

    # Non-admins cannot add or remove members.
    forbidden = client.post(
        f"/api/conversations/{group['id']}/members", json={"user_ids": [carol["user"]["id"]]}, headers=bob_headers
    )
    assert forbidden.status_code == 403

    added = client.post(
        f"/api/conversations/{group['id']}/members", json={"user_ids": [carol["user"]["id"]]}, headers=alice_headers
    ).json()
    assert len(added["members"]) == 3

    removed = client.delete(f"/api/conversations/{group['id']}/members/{carol['user']['id']}", headers=alice_headers)
    assert removed.status_code == 204
    members = client.get(f"/api/conversations/{group['id']}", headers=alice_headers).json()["members"]
    assert carol["user"]["id"] not in [m["user"]["id"] for m in members]

    # The last admin leaving promotes someone else.
    client.delete(f"/api/conversations/{group['id']}/members/{_me(client, alice_headers)}", headers=alice_headers)
    assert client.get(f"/api/conversations/{group['id']}", headers=bob_headers).json()["my_role"] == "admin"
    assert client.get(f"/api/conversations/{group['id']}", headers=alice_headers).status_code == 404


def test_non_member_cannot_read_messages(client):
    alice_headers, _ = login(client, ALICE)
    henry_headers, _ = login(client, HENRY)
    conversation_id = client.get("/api/conversations", headers=alice_headers).json()[0]["id"]
    assert client.get(f"/api/conversations/{conversation_id}/messages", headers=henry_headers).status_code == 404


def test_reactions_and_replies(client):
    headers, _ = login(client, ALICE)
    _, bob = login(client, BOB)
    conversation = _direct(client, headers, bob["user"]["id"])
    original = _send(client, headers, conversation["id"], "original").json()
    reply = client.post(
        f"/api/conversations/{conversation['id']}/messages",
        json={"body": "reply", "client_id": uuid.uuid4().hex, "reply_to_id": original["id"]},
        headers=headers,
    ).json()
    assert reply["reply_to"]["id"] == original["id"]
    assert client.put(f"/api/messages/{original['id']}/reaction", json={"emoji": "❤️"}, headers=headers).status_code == 204
    page = client.get(f"/api/conversations/{conversation['id']}/messages", headers=headers).json()
    reacted = next(m for m in page["messages"] if m["id"] == original["id"])
    assert reacted["reactions"][0]["emoji"] == "❤️"


def _me(client, headers):
    return client.get("/api/users/me", headers=headers).json()["id"]
