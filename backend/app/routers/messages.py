from fastapi import APIRouter, BackgroundTasks, Depends, File, UploadFile, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, push
from ..models import User
from ..schemas import AttachmentOut, ReactionSet
from ..services import attachments as attachment_service
from ..services import messages as service

router = APIRouter(tags=["messages"])


@router.put("/messages/{message_id}/reaction", status_code=status.HTTP_204_NO_CONTENT)
def react(
    message_id: int,
    body: ReactionSet,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Set (or replace) the current user's single reaction on a message."""
    push(background, [service.set_reaction(db, user.id, message_id, body.emoji)])


@router.delete("/messages/{message_id}/reaction", status_code=status.HTTP_204_NO_CONTENT)
def unreact(
    message_id: int,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    push(background, [service.remove_reaction(db, user.id, message_id)])


@router.post("/attachments", response_model=AttachmentOut, status_code=status.HTTP_201_CREATED)
async def upload_attachment(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload first, then reference the returned id from a message or avatar."""
    return await attachment_service.store_upload(db, user.id, file)
