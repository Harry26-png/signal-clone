"""Direct and group conversations: listing, creation, settings and group membership/admin controls."""

import random

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..database import utcnow
from ..models import Conversation, ConversationMember, Message, MessageReceipt, User
from ..schemas import AVATAR_COLORS, ConversationOut, ConversationUpdate, GroupCreate, MemberOut
from . import presenters
from .errors import BadRequest, Forbidden, NotFound
from .membership import member_ids, require_admin, require_membership
from .messages import (
    Delivery,
    add_system_message,
    load_messages,
    new_message_delivery,
    not_expired,
    serialize_messages,
)


def _load(db: Session, conversation_id: int) -> Conversation:
    conversation = db.scalar(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .options(selectinload(Conversation.members).selectinload(ConversationMember.user))
    )
    if conversation is None:
        raise NotFound("Conversation not found")
    return conversation


def serialize_for(db: Session, conversations: list[Conversation], viewer_id: int) -> list[ConversationOut]:
    """Viewer-specific representation: unread count, the viewer's role and latest visible message."""
    if not conversations:
        return []
    ids = [c.id for c in conversations]
    visible = not_expired(utcnow())

    last_ids = dict(
        db.execute(
            select(Message.conversation_id, func.max(Message.id))
            .where(Message.conversation_id.in_(ids), visible)
            .group_by(Message.conversation_id)
        ).all()
    )
    last_messages = {
        m.conversation_id: m for m in serialize_messages(db, load_messages(db, last_ids.values()))
    }
    unread = dict(
        db.execute(
            select(Message.conversation_id, func.count())
            .join(MessageReceipt, MessageReceipt.message_id == Message.id)
            .where(
                Message.conversation_id.in_(ids),
                MessageReceipt.user_id == viewer_id,
                MessageReceipt.read_at.is_(None),
                visible,
            )
            .group_by(Message.conversation_id)
        ).all()
    )

    result = []
    for conversation in conversations:
        my_role = next(m.role for m in conversation.members if m.user_id == viewer_id)
        result.append(
            ConversationOut(
                id=conversation.id,
                kind=conversation.kind,
                title=conversation.title,
                description=conversation.description,
                avatar_color=conversation.avatar_color,
                disappearing_seconds=conversation.disappearing_seconds,
                created_at=conversation.created_at,
                last_activity_at=conversation.last_activity_at,
                members=[
                    MemberOut(user=presenters.user_out(m.user), role=m.role, joined_at=m.joined_at)
                    for m in sorted(conversation.members, key=lambda m: m.joined_at)
                ],
                my_role=my_role,
                unread_count=unread.get(conversation.id, 0),
                last_message=last_messages.get(conversation.id),
            )
        )
    return result


def list_for_user(db: Session, user_id: int) -> list[ConversationOut]:
    conversations = list(
        db.scalars(
            select(Conversation)
            .join(ConversationMember)
            .where(ConversationMember.user_id == user_id)
            .order_by(Conversation.last_activity_at.desc())
            .options(selectinload(Conversation.members).selectinload(ConversationMember.user))
        )
    )
    return serialize_for(db, conversations, user_id)


def get_for_user(db: Session, user_id: int, conversation_id: int) -> ConversationOut:
    require_membership(db, conversation_id, user_id)
    return serialize_for(db, [_load(db, conversation_id)], user_id)[0]


def updated_delivery(user_ids: list[int], conversation_id: int) -> Delivery:
    # Payload is viewer-specific, so clients refetch GET /conversations/{id} on this signal.
    return user_ids, {"type": "conversation.updated", "conversation_id": conversation_id}


def get_or_create_direct(db: Session, user_id: int, other_id: int) -> tuple[int, list[Delivery]]:
    if other_id == user_id:
        raise BadRequest("You cannot start a chat with yourself")
    if db.get(User, other_id) is None:
        raise NotFound("User not found")

    key = f"{min(user_id, other_id)}:{max(user_id, other_id)}"
    existing = db.scalar(select(Conversation.id).where(Conversation.direct_key == key))
    if existing is not None:
        return existing, []

    conversation = Conversation(kind="direct", direct_key=key, created_by_id=user_id)
    conversation.members = [
        ConversationMember(user_id=user_id, role="member"),
        ConversationMember(user_id=other_id, role="member"),
    ]
    db.add(conversation)
    db.commit()
    return conversation.id, [updated_delivery([user_id, other_id], conversation.id)]


def _existing_user_ids(db: Session, user_ids: list[int]) -> list[int]:
    found = set(db.scalars(select(User.id).where(User.id.in_(user_ids))))
    missing = set(user_ids) - found
    if missing:
        raise NotFound(f"Unknown user ids: {sorted(missing)}")
    return list(dict.fromkeys(user_ids))  # de-duplicated, order preserved


def create_group(db: Session, creator_id: int, data: GroupCreate) -> tuple[int, list[Delivery]]:
    invited = [uid for uid in _existing_user_ids(db, data.member_ids) if uid != creator_id]
    if not invited:
        raise BadRequest("Add at least one other member")

    conversation = Conversation(
        kind="group",
        title=data.title.strip(),
        description=data.description.strip(),
        avatar_color=random.choice(AVATAR_COLORS),
        created_by_id=creator_id,
    )
    conversation.members = [ConversationMember(user_id=creator_id, role="admin")] + [
        ConversationMember(user_id=uid, role="member") for uid in invited
    ]
    db.add(conversation)
    db.flush()
    message = add_system_message(db, conversation, creator_id, {"event": "group_created"})
    db.commit()

    everyone = [creator_id, *invited]
    return conversation.id, [
        updated_delivery(everyone, conversation.id),
        new_message_delivery(db, message),
    ]


def update_settings(
    db: Session, user_id: int, conversation_id: int, data: ConversationUpdate
) -> list[Delivery]:
    require_membership(db, conversation_id, user_id)
    conversation = _load(db, conversation_id)
    events: list[Message] = []

    if data.title is not None or data.description is not None:
        if conversation.kind != "group":
            raise BadRequest("Only groups have a name and description")
        if data.title is not None and data.title.strip() != conversation.title:
            conversation.title = data.title.strip()
            events.append(
                add_system_message(db, conversation, user_id, {"event": "title_changed", "title": conversation.title})
            )
        if data.description is not None:
            conversation.description = data.description.strip()

    if data.disappearing_seconds is not None and data.disappearing_seconds != conversation.disappearing_seconds:
        conversation.disappearing_seconds = data.disappearing_seconds
        events.append(
            add_system_message(
                db, conversation, user_id, {"event": "timer_changed", "seconds": data.disappearing_seconds}
            )
        )

    db.commit()
    everyone = member_ids(db, conversation_id)
    return [updated_delivery(everyone, conversation_id)] + [new_message_delivery(db, m) for m in events]


def add_members(db: Session, actor_id: int, conversation_id: int, user_ids: list[int]) -> list[Delivery]:
    require_admin(db, conversation_id, actor_id)
    conversation = _load(db, conversation_id)
    if conversation.kind != "group":
        raise BadRequest("Members can only be added to groups")

    current = {m.user_id for m in conversation.members}
    added = [uid for uid in _existing_user_ids(db, user_ids) if uid not in current]
    if not added:
        raise BadRequest("Those people are already in the group")

    now = utcnow()
    conversation.members.extend(
        ConversationMember(user_id=uid, role="member", joined_at=now) for uid in added
    )
    message = add_system_message(db, conversation, actor_id, {"event": "members_added", "user_ids": added})
    db.commit()
    return [
        updated_delivery(member_ids(db, conversation_id), conversation_id),
        new_message_delivery(db, message),
    ]


def remove_member(db: Session, actor_id: int, conversation_id: int, target_id: int) -> list[Delivery]:
    """Admins can remove anyone; any member can remove themselves (leave the group)."""
    leaving = actor_id == target_id
    if leaving:
        require_membership(db, conversation_id, actor_id)
    else:
        require_admin(db, conversation_id, actor_id)

    conversation = _load(db, conversation_id)
    if conversation.kind != "group":
        raise BadRequest("You cannot leave a direct chat")
    target = next((m for m in conversation.members if m.user_id == target_id), None)
    if target is None:
        raise NotFound("That person is not in this group")

    conversation.members.remove(target)
    removed_notice = ([target_id], {"type": "conversation.removed", "conversation_id": conversation_id})

    if not conversation.members:
        db.delete(conversation)
        db.commit()
        return [removed_notice]

    # A group must always keep an admin: promote the longest-standing member if needed.
    if not any(m.role == "admin" for m in conversation.members):
        min(conversation.members, key=lambda m: m.joined_at).role = "admin"

    payload = {"event": "member_left", "user_id": target_id} if leaving else {
        "event": "member_removed",
        "user_id": target_id,
    }
    message = add_system_message(db, conversation, actor_id, payload)
    db.commit()
    return [
        removed_notice,
        updated_delivery(member_ids(db, conversation_id), conversation_id),
        new_message_delivery(db, message),
    ]


def set_member_role(
    db: Session, actor_id: int, conversation_id: int, target_id: int, role: str
) -> list[Delivery]:
    require_admin(db, conversation_id, actor_id)
    conversation = _load(db, conversation_id)
    target = next((m for m in conversation.members if m.user_id == target_id), None)
    if target is None:
        raise NotFound("That person is not in this group")
    if target.role == role:
        return []
    if role == "member" and sum(m.role == "admin" for m in conversation.members) == 1:
        raise Forbidden("A group needs at least one admin")

    target.role = role
    message = add_system_message(
        db, conversation, actor_id, {"event": "role_changed", "user_id": target_id, "role": role}
    )
    db.commit()
    return [
        updated_delivery(member_ids(db, conversation_id), conversation_id),
        new_message_delivery(db, message),
    ]
