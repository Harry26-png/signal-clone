import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy.orm import Session

from ..config import settings
from ..models import Attachment
from ..schemas import AttachmentOut
from . import presenters
from .errors import BadRequest

CHUNK_SIZE = 1024 * 1024


async def store_upload(db: Session, uploader_id: int, upload: UploadFile) -> AttachmentOut:
    attachment_id = uuid.uuid4().hex
    suffix = Path(upload.filename or "").suffix.lower()[:10]
    storage_name = f"{attachment_id}{suffix}"
    destination = settings.upload_dir / storage_name

    size = 0
    with destination.open("wb") as out:
        while chunk := await upload.read(CHUNK_SIZE):
            size += len(chunk)
            if size > settings.max_upload_bytes:
                out.close()
                destination.unlink(missing_ok=True)
                raise BadRequest("Files must be 10 MB or smaller")
            out.write(chunk)

    attachment = Attachment(
        id=attachment_id,
        uploader_id=uploader_id,
        file_name=(upload.filename or "file")[:255],
        content_type=upload.content_type or "application/octet-stream",
        size_bytes=size,
        storage_name=storage_name,
    )
    db.add(attachment)
    db.commit()
    return presenters.attachment_out(attachment)
