"""JWT 认证 — 单用户密码保护"""
import os
import datetime
import jwt
from fastapi import Header, HTTPException

SECRET_KEY = os.environ.get("ACCESS_PASSWORD", "fitness-tracker-default")

TOKEN_EXPIRE_DAYS = 365


def create_token() -> str:
    """用环境变量密码签发 JWT"""
    payload = {
        "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=TOKEN_EXPIRE_DAYS),
        "iat": datetime.datetime.now(datetime.timezone.utc),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def verify_token(token: str) -> bool:
    """验证 JWT 是否有效"""
    try:
        jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return True
    except jwt.ExpiredSignatureError:
        return False
    except jwt.InvalidTokenError:
        return False


def get_current_user(authorization: str = Header(None)) -> bool:
    """FastAPI 依赖：从 Authorization header 校验登录态"""
    if not authorization:
        raise HTTPException(status_code=401, detail="请先登录")
    token = authorization.replace("Bearer ", "")
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录")
    return True
