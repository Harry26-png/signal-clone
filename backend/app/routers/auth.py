from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..deps import get_token
from ..schemas import AuthResponse, OtpRequest, OtpResponse, VerifyRequest
from ..services import presenters
from ..services import users as user_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/otp", response_model=OtpResponse)
def request_otp(body: OtpRequest, db: Session = Depends(get_db)):
    """Mocked SMS step: nothing is sent; the fixed code is returned as a hint."""
    return OtpResponse(
        is_registered=user_service.is_registered(db, body.phone),
        hint=f"Use verification code {settings.mock_otp}",
    )


@router.post("/verify", response_model=AuthResponse)
def verify(body: VerifyRequest, db: Session = Depends(get_db)):
    token, user, is_new = user_service.verify_and_login(db, body.phone, body.code)
    return AuthResponse(token=token, user=presenters.user_out(user), is_new_user=is_new)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(token: str = Depends(get_token), db: Session = Depends(get_db)):
    user_service.logout(db, token)
