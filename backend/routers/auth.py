from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from schemas.auth import AuthResponse, LoginRequest, SignupRequest, UserOut
from services.auth_service import (
    AuthError,
    authenticate_user,
    create_access_token,
    create_user,
    get_user_by_id,
    parse_token,
    to_public_user,
)


router = APIRouter()
_security = HTTPBearer(auto_error=False)


def _validate_password(password: str) -> None:
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")


@router.post("/signup", response_model=AuthResponse)
def signup(payload: SignupRequest):
    _validate_password(payload.password)

    try:
        user = create_user(payload.name, payload.email, payload.password)
    except AuthError as exc:
        detail = str(exc)
        if "already exists" in detail:
            raise HTTPException(status_code=400, detail=detail) from exc
        if "Database" in detail or "database" in detail or "MongoDB" in detail:
            raise HTTPException(status_code=503, detail=detail) from exc
        raise HTTPException(status_code=400, detail=detail) from exc

    public = to_public_user(user)
    token = create_access_token(public["id"], public["email"])
    return AuthResponse(access_token=token, user=UserOut(**public))


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest):
    try:
        user = authenticate_user(payload.email, payload.password)
    except AuthError as exc:
        detail = str(exc)
        if "Database" in detail or "database" in detail or "MongoDB" in detail:
            raise HTTPException(status_code=503, detail=detail) from exc
        raise HTTPException(status_code=401, detail=detail) from exc

    public = to_public_user(user)
    token = create_access_token(public["id"], public["email"])
    return AuthResponse(access_token=token, user=UserOut(**public))


@router.get("/me", response_model=UserOut)
def me(credentials: HTTPAuthorizationCredentials = Depends(_security)):
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")

    try:
        payload = parse_token(credentials.credentials)
        user = get_user_by_id(payload["uid"])
    except AuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    if not user:
        raise HTTPException(status_code=401, detail="User not found.")

    return UserOut(**to_public_user(user))
