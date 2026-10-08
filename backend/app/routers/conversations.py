from fastapi import APIRouter, BackgroundTasks, Depends, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, push
from ..models import User
from ..schemas import (
    ConversationOut,
    ConversationUpdate,
    DirectCreate,
    GroupCreate,
    MemberRoleUpdate,
    MembersAdd,
    MessageCreate,
    MessageOut,
    MessagePage,
)
from ..services import conversations as service
from ..services import messages as message_service

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("", response_model=list[ConversationOut])
def list_conversations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """All conversations the user belongs to, most recent activity first."""
    return service.list_for_user(db, user.id)


@router.post("/direct", response_model=ConversationOut)
def open_direct(
    body: DirectCreate,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Idempotent: returns the existing 1:1 chat with that user or creates it."""
    conversation_id, deliveries = service.get_or_create_direct(db, user.id, body.user_id)
    push(background, deliveries)
    return service.get_for_user(db, user.id, conversation_id)


@router.post("/groups", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
def create_group(
    body: GroupCreate,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation_id, deliveries = service.create_group(db, user.id, body)
    push(background, deliveries)
    return service.get_for_user(db, user.id, conversation_id)


@router.get("/{conversation_id}", response_model=ConversationOut)
def get_conversation(conversation_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.get_for_user(db, user.id, conversation_id)


@router.patch("/{conversation_id}", response_model=ConversationOut)
def update_conversation(
    conversation_id: int,
    body: ConversationUpdate,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Rename a group, edit its description or change the disappearing-messages timer."""
    push(background, service.update_settings(db, user.id, conversation_id, body))
    return service.get_for_user(db, user.id, conversation_id)


# ---------- Group membership (admin controls) ----------


@router.post("/{conversation_id}/members", response_model=ConversationOut)
def add_members(
    conversation_id: int,
    body: MembersAdd,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    push(background, service.add_members(db, user.id, conversation_id, body.user_ids))
    return service.get_for_user(db, user.id, conversation_id)


@router.patch("/{conversation_id}/members/{member_id}", response_model=ConversationOut)
def update_member_role(
    conversation_id: int,
    member_id: int,
    body: MemberRoleUpdate,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    push(background, service.set_member_role(db, user.id, conversation_id, member_id, body.role))
    return service.get_for_user(db, user.id, conversation_id)


@router.delete("/{conversation_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    conversation_id: int,
    member_id: int,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admins remove members; removing yourself leaves the group."""
    push(background, service.remove_member(db, user.id, conversation_id, member_id))


# ---------- Messages ----------


@router.get("/{conversation_id}/messages", response_model=MessagePage)
def list_messages(
    conversation_id: int,
    before_id: int | None = Query(default=None, description="Cursor: return messages older than this id"),
    limit: int = Query(default=50, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return message_service.list_messages(db, user.id, conversation_id, before_id, limit)


@router.post("/{conversation_id}/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def send_message(
    conversation_id: int,
    body: MessageCreate,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    message = message_service.create_message(db, user.id, conversation_id, body)
    delivery = message_service.new_message_delivery(db, message)
    push(background, [delivery])
    return delivery[1]["message"]


@router.post("/{conversation_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_read(
    conversation_id: int,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark every message in the conversation as read by the current user (drives blue read ticks)."""
    push(background, message_service.mark_read(db, user.id, conversation_id))
