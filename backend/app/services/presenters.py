"""Map ORM objects to API schemas. Kept separate so services and routes share one representation."""

from ..models import Attachment, Message, User
from ..realtime import manager
from ..schemas import AttachmentOut, MessageOut, ReactionOut, ReplyPreview, UserOut


def user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        phone=user.phone,
        username=user.username,
        display_name=user.display_name,
        about=user.about,
        avatar_color=user.avatar_color,
        avatar_url=user.avatar_path,
        online=manager.is_online(user.id),
        last_seen_at=user.last_seen_at,
    )


def attachment_out(attachment: Attachment | None) -> AttachmentOut | None:
    if attachment is None:
        return None
    return AttachmentOut(
        id=attachment.id,
        url=attachment.url,
        file_name=attachment.file_name,
        content_type=attachment.content_type,
        size_bytes=attachment.size_bytes,
    )


def message_out(message: Message, status: str) -> MessageOut:
    reply = message.reply_to
    return MessageOut(
        id=message.id,
        conversation_id=message.conversation_id,
        sender_id=message.sender_id,
        kind=message.kind,
        body=message.body,
        client_id=message.client_id,
        created_at=message.created_at,
        expires_at=message.expires_at,
        reply_to=(
            ReplyPreview(
                id=reply.id,
                sender_id=reply.sender_id,
                kind=reply.kind,
                body=reply.body,
                attachment=attachment_out(reply.attachment),
            )
            if reply
            else None
        ),
        attachment=attachment_out(message.attachment),
        reactions=[ReactionOut(user_id=r.user_id, emoji=r.emoji) for r in message.reactions],
        status=status,
    )
