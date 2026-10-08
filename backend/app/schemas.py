"""Pydantic request/response models (the public API contract)."""

from datetime import datetime, timezone
from typing import Annotated, Literal, get_args

from pydantic import BaseModel, Field, PlainSerializer


def _iso_utc(value: datetime) -> str:
    return value.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")


# Stored timestamps are naive UTC; serialize them with an explicit "Z" so browsers parse them correctly.
UTCDateTime = Annotated[datetime, PlainSerializer(_iso_utc, return_type=str)]

AvatarColor = Literal[
    "A100", "A110", "A120", "A130", "A140", "A150", "A160", "A170", "A180", "A190", "A200", "A210"
]
AVATAR_COLORS: tuple[str, ...] = get_args(AvatarColor)
Role = Literal["admin", "member"]
MessageStatus = Literal["sent", "delivered", "read"]


# ---------- Users & auth ----------


class UserOut(BaseModel):
    id: int
    phone: str
    username: str | None
    display_name: str
    about: str
    avatar_color: str
    avatar_url: str | None
    online: bool
    last_seen_at: UTCDateTime


class OtpRequest(BaseModel):
    phone: str = Field(min_length=6, max_length=20)


class OtpResponse(BaseModel):
    is_registered: bool
    # Verification is mocked; the code is surfaced so the demo is usable.
    hint: str


class VerifyRequest(BaseModel):
    phone: str = Field(min_length=6, max_length=20)
    code: str = Field(min_length=4, max_length=8)


class AuthResponse(BaseModel):
    token: str
    user: UserOut
    is_new_user: bool


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=64)
    about: str | None = Field(default=None, max_length=140)
    username: str | None = Field(default=None, max_length=32)
    avatar_color: AvatarColor | None = None


class AvatarSet(BaseModel):
    # An uploaded image attachment id, or null to remove the photo.
    attachment_id: str | None


class ContactCreate(BaseModel):
    user_id: int


# ---------- Messages ----------


class AttachmentOut(BaseModel):
    id: str
    url: str
    file_name: str
    content_type: str
    size_bytes: int


class ReactionOut(BaseModel):
    user_id: int
    emoji: str


class ReplyPreview(BaseModel):
    id: int
    sender_id: int | None
    kind: str
    body: str
    attachment: AttachmentOut | None


class MessageOut(BaseModel):
    id: int
    conversation_id: int
    sender_id: int | None
    kind: Literal["text", "system"]
    body: str
    client_id: str | None
    created_at: UTCDateTime
    expires_at: UTCDateTime | None
    reply_to: ReplyPreview | None
    attachment: AttachmentOut | None
    reactions: list[ReactionOut]
    # Aggregated receipt status; only meaningful to the sender.
    status: MessageStatus


class MessagePage(BaseModel):
    messages: list[MessageOut]
    has_more: bool


class MessageCreate(BaseModel):
    body: str = Field(default="", max_length=4000)
    client_id: str = Field(min_length=1, max_length=64)
    reply_to_id: int | None = None
    attachment_id: str | None = None


class ReactionSet(BaseModel):
    emoji: str = Field(min_length=1, max_length=16)


# ---------- Conversations ----------


class MemberOut(BaseModel):
    user: UserOut
    role: Role
    joined_at: UTCDateTime


class ConversationOut(BaseModel):
    id: int
    kind: Literal["direct", "group"]
    title: str | None
    description: str
    avatar_color: str
    disappearing_seconds: int
    created_at: UTCDateTime
    last_activity_at: UTCDateTime
    members: list[MemberOut]
    my_role: Role
    unread_count: int
    last_message: MessageOut | None


class DirectCreate(BaseModel):
    user_id: int


class GroupCreate(BaseModel):
    title: str = Field(min_length=1, max_length=64)
    description: str = Field(default="", max_length=255)
    member_ids: list[int] = Field(min_length=1)


class ConversationUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=64)
    description: str | None = Field(default=None, max_length=255)
    disappearing_seconds: int | None = Field(default=None, ge=0, le=60 * 60 * 24 * 28)


class MembersAdd(BaseModel):
    user_ids: list[int] = Field(min_length=1)


class MemberRoleUpdate(BaseModel):
    role: Role
