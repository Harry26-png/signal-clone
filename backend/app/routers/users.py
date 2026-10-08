from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, push
from ..models import User
from ..schemas import AvatarSet, ProfileUpdate, UserOut
from ..services import presenters
from ..services import users as user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return presenters.user_out(user)


@router.patch("/me", response_model=UserOut)
def update_me(
    body: ProfileUpdate,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result, deliveries = user_service.update_profile(db, user, body)
    push(background, deliveries)
    return result


@router.put("/me/avatar", response_model=UserOut)
def set_avatar(
    body: AvatarSet,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result, deliveries = user_service.set_avatar(db, user, body.attachment_id)
    push(background, deliveries)
    return result


@router.get("/lookup", response_model=UserOut)
def lookup(
    q: str = Query(min_length=1, max_length=40),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return presenters.user_out(user_service.lookup(db, q))
