"""健身管理工具 — 后端入口"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import init_db
from app.auth import get_current_user
from app.routers import workouts, photos, goals, dashboard, notes, auth, sessions

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_DIR = os.path.dirname(BACKEND_DIR)
FRONTEND_DIST = os.path.join(PROJECT_DIR, "frontend", "dist")
PHOTOS_DIR = os.path.join(BACKEND_DIR, "data", "photos")

FRONTEND_EXISTS = os.path.isdir(FRONTEND_DIST)

app = FastAPI(
    title="健身管理工具",
    description="个人健身记录、照片分析、体态改善追踪",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 挂载照片静态目录
os.makedirs(PHOTOS_DIR, exist_ok=True)
app.mount("/photos", StaticFiles(directory=PHOTOS_DIR), name="photos")

# 注册路由（auth 不需要登录保护，其余需要）
app.include_router(auth.router)
app.include_router(workouts.router, dependencies=[Depends(get_current_user)])
app.include_router(photos.router, dependencies=[Depends(get_current_user)])
app.include_router(goals.router, dependencies=[Depends(get_current_user)])
app.include_router(dashboard.router, dependencies=[Depends(get_current_user)])
app.include_router(notes.router, dependencies=[Depends(get_current_user)])
app.include_router(sessions.router, dependencies=[Depends(get_current_user)])


@app.on_event("startup")
def startup():
    init_db()
    if not FRONTEND_EXISTS:
        print(f"[WARNING] 前端构建目录不存在: {FRONTEND_DIST}")


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "fitness-tracker", "version": "1.0.0"}


# 前端 SPA 托管
if FRONTEND_EXISTS:
    assets_dir = os.path.join(FRONTEND_DIST, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    from fastapi.responses import FileResponse

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = os.path.join(FRONTEND_DIST, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8900, reload=False)
