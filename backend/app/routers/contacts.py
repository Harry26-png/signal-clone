from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import User
from ..schemas import ContactCreate, UserOut
from ..services import users as user_service

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("", response_model=list[UserOut])
def list_contacts(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return user_service.list_contacts(db, user.id)


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def add_contact(body: ContactCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return user_service.add_contact(db, user.id, body.user_id)


@router.delete("/{contact_user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_contact(contact_user_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user_service.remove_contact(db, user.id, contact_user_id)
