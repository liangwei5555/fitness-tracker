"""登录接口"""
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.auth import create_token

router = APIRouter(prefix="/api/auth", tags=["auth"])

ACCESS_PASSWORD = os.environ.get("ACCESS_PASSWORD", "fitness-tracker-default")


class LoginRequest(BaseModel):
    password: str


class LoginResponse(BaseModel):
    token: str


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest):
    """密码登录，返回 JWT token（有效期 30 天）"""
    if body.password != ACCESS_PASSWORD:
        raise HTTPException(status_code=403, detail="密码错误")
    return LoginResponse(token=create_token())
