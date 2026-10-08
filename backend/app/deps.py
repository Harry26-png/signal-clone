"""Shared FastAPI dependencies."""

from fastapi import BackgroundTasks, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import User
from .realtime import manager
from .services import users as user_service
from .services.messages import Delivery

_bearer = HTTPBearer(auto_error=False)


def get_token(credentials: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> str:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in")
    return credentials.credentials


def get_current_user(token: str = Depends(get_token), db: Session = Depends(get_db)) -> User:
    user = user_service.user_for_token(db, token)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired")
    return user


def push(background: BackgroundTasks, deliveries: list[Delivery]) -> None:
    """Send WebSocket events once the HTTP response has gone out (and the DB commit is visible)."""
    if deliveries:
        background.add_task(manager.send_many, deliveries)
