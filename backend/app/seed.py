"""Demo data so the app is usable immediately. Runs on startup when the users table is empty.

Run manually (wipes and re-creates the database):  python -m app.seed --reset
"""

import json
import sys
from datetime import timedelta
from itertools import permutations

from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import Base, SessionLocal, engine, utcnow
from .models import Contact, Conversation, ConversationMember, Message, MessageReceipt, Reaction, User

USERS = [
    # key, phone, display name, username, about, avatar colour, last seen (minutes ago)
    ("alice", "+15550100001", "Alice Johnson", "alice.01", "Coffee first ☕", "A110", 0),
    ("bob", "+15550100002", "Bob Martinez", "bob.42", "Out hiking 🏔️", "A130", 3),
    ("carol", "+15550100003", "Carol Nguyen", "carol.07", "Designer · Plant parent 🌿", "A150", 45),
    ("david", "+15550100004", "David Kim", None, "", "A120", 60 * 5),
    ("emma", "+15550100005", "Emma Wilson", "emma.99", "Available", "A170", 12),
    ("frank", "+15550100006", "Frank Osei", None, "Busy", "A180", 60 * 26),
    ("grace", "+15550100007", "Grace Patel", "grace.11", "", "A140", 60 * 24 * 3),
    ("henry", "+15550100008", "Henry Clarke", "henry.20", "Signal me 👋", "A200", 90),
]

# Every pair are contacts, except Alice <-> Henry (so "add a contact" can be demoed from Alice's account).
NOT_CONTACTS = {("alice", "henry"), ("henry", "alice")}

# (sender, body, minutes ago, recipients' receipt state)
Script = list[tuple[str, str, int, str]]

CONVERSATIONS: list[dict] = [
    {
        "kind": "direct",
        "members": ["alice", "bob"],
        "messages": [
            ("bob", "Hey! Are we still on for the trail this weekend?", 60 * 26, "read"),
            ("alice", "Yes! Saturday morning works best for me", 60 * 26 - 2, "read"),
            ("bob", "Perfect. I'll check the weather forecast", 60 * 26 - 3, "read"),
            ("alice", "Should we invite Carol and Emma too?", 60 * 25, "read"),
            ("bob", "Already made a group for it 😄", 60 * 25 - 1, "read"),
            ("alice", "Ha, of course you did", 60 * 3, "read"),
            ("alice", "Did you get the new boots?", 60 * 3 - 1, "read"),
            ("bob", "Picked them up yesterday. Breaking them in now", 40, "read"),
            ("bob", "Also, can you bring the first aid kit?", 6, "delivered"),
            ("bob", "Mine is missing half the bandages 🙈", 5, "delivered"),
        ],
        "reactions": [(7, "alice", "👍")],
        "replies": {7: 6},  # message index 7 replies to index 6
    },
    {
        "kind": "group",
        "title": "Weekend Hiking 🥾",
        "description": "Trails, snacks and bad jokes",
        "avatar_color": "A130",
        "admin": "bob",
        "members": ["bob", "alice", "carol", "emma"],
        "messages": [
            ("bob", "Welcome everyone! Planning Saturday's hike here", 60 * 25, "read"),
            ("carol", "So excited! Which trail?", 60 * 24, "read"),
            ("bob", "Thinking Eagle Peak loop. ~8 miles, nice views", 60 * 24 - 5, "read"),
            ("emma", "I'm in. I'll bring sandwiches 🥪", 60 * 5, "read"),
            ("alice", "I can drive, my car fits 5", 60 * 4, "read"),
            ("carol", "Meet at 7am at the coffee place?", 25, "delivered"),
            ("emma", "7 is early but okay 😅", 18, "delivered"),
            ("bob", "7am it is. Don't forget water!", 9, "delivered"),
        ],
        "reactions": [(4, "bob", "❤️"), (4, "carol", "🙏"), (6, "carol", "😂")],
        "replies": {6: 5},
    },
    {
        "kind": "direct",
        "members": ["alice", "carol"],
        "messages": [
            ("carol", "Can you send me the slides from yesterday?", 60 * 24 * 3, "read"),
            ("alice", "Sure, give me a minute", 60 * 24 * 3 - 2, "read"),
            ("alice", "Just emailed them over", 60 * 24 * 3 - 10, "read"),
            ("carol", "Got them, thank you!! 🙏", 60 * 24 * 3 - 12, "read"),
            ("alice", "Let me know if the colours look off on your screen", 60 * 50, "read"),
        ],
        "reactions": [(3, "alice", "❤️")],
    },
    {
        "kind": "group",
        "title": "Project Phoenix",
        "description": "Q4 launch coordination",
        "avatar_color": "A160",
        "admin": "david",
        "members": ["david", "alice", "frank", "grace"],
        "messages": [
            ("david", "Kickoff notes are in the shared drive", 60 * 30, "read"),
            ("frank", "Thanks David. I'll review the API section", 60 * 29, "read"),
            ("grace", "QA plan is drafted, feedback welcome", 60 * 7, "read"),
            ("alice", "Looks great Grace, left a few comments", 60 * 6, "read"),
            ("david", "Standup moved to 10:30 tomorrow", 60 * 2, "read"),
        ],
        "reactions": [(2, "david", "👍")],
    },
    {
        "kind": "direct",
        "members": ["alice", "david"],
        "messages": [
            ("david", "Do you have a minute to review my PR?", 60 * 24 * 6, "read"),
            ("alice", "On it now", 60 * 24 * 6 - 4, "read"),
            ("alice", "Approved with a couple of nits", 60 * 24 * 6 - 30, "delivered"),
        ],
    },
    {
        "kind": "direct",
        "members": ["alice", "emma"],
        "disappearing_seconds": 60 * 60 * 24 * 7,
        "messages": [
            ("emma", "Turning on disappearing messages for this chat 🔒", 60 * 2, "read"),
            ("emma", "Gate code for the party is 4512", 60 * 2 - 1, "read"),
            ("alice", "Got it, see you there!", 60 + 30, "read"),
        ],
    },
    {
        "kind": "direct",
        "members": ["bob", "carol"],
        "messages": [
            ("carol", "Are you bringing the tent?", 60 * 8, "read"),
            ("bob", "Yep, the big one", 60 * 8 - 3, "read"),
        ],
    },
]


def _seed_users(db: Session, now) -> dict[str, User]:
    users: dict[str, User] = {}
    for key, phone, name, username, about, color, last_seen in USERS:
        user = User(
            phone=phone,
            display_name=name,
            username=username,
            about=about,
            avatar_color=color,
            last_seen_at=now - timedelta(minutes=last_seen),
            created_at=now - timedelta(days=30),
        )
        db.add(user)
        users[key] = user
    db.flush()
    for owner, contact in permutations(users, 2):
        if (owner, contact) not in NOT_CONTACTS:
            db.add(Contact(owner_id=users[owner].id, contact_user_id=users[contact].id))
    return users


def _seed_conversation(db: Session, spec: dict, users: dict[str, User], now) -> None:
    script: Script = spec["messages"]
    started = now - timedelta(minutes=script[0][2] + 5)
    keys: list[str] = spec["members"]

    conversation = Conversation(
        kind=spec["kind"],
        title=spec.get("title"),
        description=spec.get("description", ""),
        avatar_color=spec.get("avatar_color", "A100"),
        direct_key=(
            ":".join(str(i) for i in sorted(users[k].id for k in keys)) if spec["kind"] == "direct" else None
        ),
        disappearing_seconds=spec.get("disappearing_seconds", 0),
        created_by_id=users[keys[0]].id,
        created_at=started,
    )
    conversation.members = [
        ConversationMember(
            user_id=users[k].id,
            role="admin" if spec.get("admin") == k else "member",
            joined_at=started + timedelta(seconds=i),
        )
        for i, k in enumerate(keys)
    ]
    db.add(conversation)
    db.flush()

    if spec["kind"] == "group":
        db.add(
            Message(
                conversation_id=conversation.id,
                sender_id=users[spec["admin"]].id,
                kind="system",
                body=json.dumps({"event": "group_created"}),
                created_at=started,
            )
        )
    if conversation.disappearing_seconds:
        db.add(
            Message(
                conversation_id=conversation.id,
                sender_id=users[keys[-1]].id,
                kind="system",
                body=json.dumps({"event": "timer_changed", "seconds": conversation.disappearing_seconds}),
                created_at=started,
            )
        )

    messages: list[Message] = []
    for index, (sender, body, minutes_ago, state) in enumerate(script):
        created = now - timedelta(minutes=minutes_ago)
        message = Message(
            conversation_id=conversation.id,
            sender_id=users[sender].id,
            kind="text",
            body=body,
            client_id=f"seed-{conversation.id}-{index}",
            created_at=created,
            expires_at=(
                created + timedelta(seconds=conversation.disappearing_seconds)
                if conversation.disappearing_seconds
                else None
            ),
        )
        reply_index = spec.get("replies", {}).get(index)
        if reply_index is not None:
            message.reply_to = messages[reply_index]
        message.receipts = [
            MessageReceipt(
                user_id=users[k].id,
                delivered_at=created + timedelta(seconds=2) if state in ("delivered", "read") else None,
                read_at=created + timedelta(minutes=1) if state == "read" else None,
            )
            for k in keys
            if k != sender
        ]
        db.add(message)
        # Flush one at a time: the self-referential reply_to lets the unit of work reorder a batched
        # INSERT, and ids must stay chronological because timelines are ordered by id.
        db.flush()
        messages.append(message)

    for index, reactor, emoji in spec.get("reactions", []):
        db.add(Reaction(message_id=messages[index].id, user_id=users[reactor].id, emoji=emoji))
    conversation.last_activity_at = messages[-1].created_at


def seed_if_empty(db: Session) -> bool:
    if db.scalar(select(User.id).limit(1)) is not None:
        return False
    now = utcnow()
    users = _seed_users(db, now)
    for spec in CONVERSATIONS:
        _seed_conversation(db, spec, users, now)
    db.commit()
    return True


if __name__ == "__main__":
    if "--reset" in sys.argv:
        Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as session:
        print("Seeded demo data." if seed_if_empty(session) else "Database already has data; use --reset.")
