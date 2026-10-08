from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Contact, ConversationMember
from .errors import Forbidden, NotFound


def require_membership(db: Session, conversation_id: int, user_id: int) -> ConversationMember:
    member = db.get(ConversationMember, (conversation_id, user_id))
    if member is None:
        # 404 rather than 403 so non-members cannot probe which conversation ids exist.
        raise NotFound("Conversation not found")
    return member


def require_admin(db: Session, conversation_id: int, user_id: int) -> ConversationMember:
    member = require_membership(db, conversation_id, user_id)
    if member.role != "admin":
        raise Forbidden("Only group admins can do that")
    return member


def member_ids(db: Session, conversation_id: int) -> list[int]:
    return list(
        db.scalars(
            select(ConversationMember.user_id).where(
                ConversationMember.conversation_id == conversation_id
            )
        )
    )


def related_user_ids(db: Session, user_id: int) -> set[int]:
    """Users who should see this user's presence/profile changes: chat partners and anyone who saved them."""
    my_conversations = select(ConversationMember.conversation_id).where(
        ConversationMember.user_id == user_id
    )
    partners = select(ConversationMember.user_id).where(
        ConversationMember.conversation_id.in_(my_conversations)
    )
    savers = select(Contact.owner_id).where(Contact.contact_user_id == user_id)
    ids = set(db.scalars(partners)) | set(db.scalars(savers))
    ids.discard(user_id)
    return ids
