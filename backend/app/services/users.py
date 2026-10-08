"""Accounts, mocked phone verification, sessions, profiles and contacts."""

import random
import re
import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import utcnow
from ..models import Attachment, AuthSession, Contact, User
from ..schemas import AVATAR_COLORS, ProfileUpdate, UserOut
from . import presenters
from .errors import BadRequest, Conflict, NotFound
from .membership import related_user_ids
from .messages import Delivery

PHONE_RE = re.compile(r"^\+[1-9]\d{6,14}$")
USERNAME_RE = re.compile(r"^[a-z][a-z0-9_]{2,23}(\.\d{2,9})?$")


def normalize_phone(raw: str) -> str:
    phone = re.sub(r"[\s\-().]", "", raw)
    if not phone.startswith("+"):
        phone = f"+{phone}"
    if not PHONE_RE.match(phone):
        raise BadRequest("Enter a valid phone number including the country code")
    return phone


# ---------- Auth ----------


def is_registered(db: Session, raw_phone: str) -> bool:
    return db.scalar(select(User.id).where(User.phone == normalize_phone(raw_phone))) is not None


def verify_and_login(db: Session, raw_phone: str, code: str) -> tuple[str, User, bool]:
    """Check the (mocked) OTP, registering the number on first use. Returns (token, user, is_new)."""
    phone = normalize_phone(raw_phone)
    if code.strip() != settings.mock_otp:
        raise BadRequest("Incorrect code")

    user = db.scalar(select(User).where(User.phone == phone))
    if user is None:
        user = User(phone=phone, avatar_color=random.choice(AVATAR_COLORS))
        db.add(user)
        db.flush()

    token = secrets.token_urlsafe(32)
    db.add(AuthSession(token=token, user_id=user.id))
    db.commit()
    # Users who quit onboarding before choosing a name finish setup on their next login.
    return token, user, not user.display_name


def user_for_token(db: Session, token: str) -> User | None:
    session = db.scalar(select(AuthSession).where(AuthSession.token == token))
    return session.user if session else None


def logout(db: Session, token: str) -> None:
    session = db.scalar(select(AuthSession).where(AuthSession.token == token))
    if session is not None:
        db.delete(session)
        db.commit()


def touch_last_seen(db: Session, user_id: int) -> None:
    user = db.get(User, user_id)
    if user is not None:
        user.last_seen_at = utcnow()
        db.commit()


def presence_delivery(db: Session, user_id: int, online: bool) -> Delivery:
    user = db.get(User, user_id)
    return list(related_user_ids(db, user_id)), {
        "type": "presence",
        "user_id": user_id,
        "online": online,
        "last_seen_at": presenters.user_out(user).model_dump(mode="json")["last_seen_at"],
    }


# ---------- Profile ----------


def _profile_delivery(db: Session, user: User) -> Delivery:
    return list(related_user_ids(db, user.id)), {
        "type": "user.updated",
        "user": presenters.user_out(user).model_dump(mode="json"),
    }


def update_profile(db: Session, user: User, data: ProfileUpdate) -> tuple[UserOut, list[Delivery]]:
    if data.display_name is not None:
        user.display_name = data.display_name.strip()
    if data.about is not None:
        user.about = data.about.strip()
    if data.avatar_color is not None:
        user.avatar_color = data.avatar_color
    if data.username is not None:
        username = data.username.strip().lower().lstrip("@") or None
        if username is not None:
            if not USERNAME_RE.match(username):
                raise BadRequest(
                    "Usernames are 3-24 letters, numbers or underscores, optionally followed by .digits"
                )
            taken = db.scalar(select(User.id).where(User.username == username, User.id != user.id))
            if taken is not None:
                raise Conflict("That username is taken")
        user.username = username
    db.commit()
    return presenters.user_out(user), [_profile_delivery(db, user)]


def set_avatar(db: Session, user: User, attachment_id: str | None) -> tuple[UserOut, list[Delivery]]:
    if attachment_id is None:
        user.avatar_path = None
    else:
        attachment = db.get(Attachment, attachment_id)
        if attachment is None or attachment.uploader_id != user.id:
            raise BadRequest("Invalid attachment")
        if not attachment.content_type.startswith("image/"):
            raise BadRequest("Avatar must be an image")
        user.avatar_path = attachment.url
    db.commit()
    return presenters.user_out(user), [_profile_delivery(db, user)]


def lookup(db: Session, query: str) -> User:
    """Find an account by exact phone number or username, as Signal does (no fuzzy directory search)."""
    query = query.strip()
    if not query:
        raise BadRequest("Enter a phone number or username")
    if query.lstrip("+").replace(" ", "").replace("-", "").isdigit():
        user = db.scalar(select(User).where(User.phone == normalize_phone(query)))
    else:
        user = db.scalar(select(User).where(User.username == query.lower().lstrip("@")))
    if user is None or not user.display_name:
        raise NotFound("No Signal user found")
    return user


# ---------- Contacts ----------


def list_contacts(db: Session, owner_id: int) -> list[UserOut]:
    users = db.scalars(
        select(User)
        .join(Contact, Contact.contact_user_id == User.id)
        .where(Contact.owner_id == owner_id)
        .order_by(User.display_name)
    )
    return [presenters.user_out(u) for u in users]


def add_contact(db: Session, owner_id: int, contact_user_id: int) -> UserOut:
    if contact_user_id == owner_id:
        raise BadRequest("You cannot add yourself as a contact")
    user = db.get(User, contact_user_id)
    if user is None:
        raise NotFound("User not found")
    exists = db.scalar(
        select(Contact.id).where(Contact.owner_id == owner_id, Contact.contact_user_id == contact_user_id)
    )
    if exists is None:
        db.add(Contact(owner_id=owner_id, contact_user_id=contact_user_id))
        db.commit()
    return presenters.user_out(user)


def remove_contact(db: Session, owner_id: int, contact_user_id: int) -> None:
    contact = db.scalar(
        select(Contact).where(Contact.owner_id == owner_id, Contact.contact_user_id == contact_user_id)
    )
    if contact is None:
        raise NotFound("Contact not found")
    db.delete(contact)
    db.commit()
