"""照片管理 API"""
import os
import uuid
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Form
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.photo import DailyPhoto

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PHOTOS_DIR = os.path.join(BACKEND_DIR, "data", "photos")
os.makedirs(PHOTOS_DIR, exist_ok=True)

router = APIRouter(prefix="/api/photos", tags=["photos"])


@router.get("/")
def list_photos(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    view_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """照片列表"""
    q = db.query(DailyPhoto)
    if date_from:
        q = q.filter(DailyPhoto.date >= date.fromisoformat(date_from))
    if date_to:
        q = q.filter(DailyPhoto.date <= date.fromisoformat(date_to))
    if view_type:
        q = q.filter(DailyPhoto.view_type == view_type)
    q = q.order_by(DailyPhoto.date.desc())
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return {"data": items, "total": total, "page": page, "page_size": page_size}


@router.post("/upload")
async def upload_photo(
    file: UploadFile = File(...),
    date_str: str = Form(default=None),
    view_type: str = Form(default="正面"),
    notes: str = Form(default=None),
    db: Session = Depends(get_db),
):
    """上传照片"""
    ext = os.path.splitext(file.filename)[1] or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(PHOTOS_DIR, filename)

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    photo_date = date.fromisoformat(date_str) if date_str else date.today()

    photo = DailyPhoto(
        date=photo_date,
        file_path=f"photos/{filename}",
        view_type=view_type,
        notes=notes,
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return photo


@router.delete("/{photo_id}")
def delete_photo(photo_id: int, db: Session = Depends(get_db)):
    """删除照片"""
    photo = db.query(DailyPhoto).filter(DailyPhoto.id == photo_id).first()
    if not photo:
        raise HTTPException(404, "照片不存在")
    # 删除文件
    full_path = os.path.join(BACKEND_DIR, "data", photo.file_path)
    if os.path.isfile(full_path):
        os.remove(full_path)
    db.delete(photo)
    db.commit()
    return {"ok": True}


@router.get("/compare")
def compare_photos(
    photo_id1: int = Query(...),
    photo_id2: int = Query(...),
    db: Session = Depends(get_db),
):
    """获取两张照片的对比数据"""
    p1 = db.query(DailyPhoto).filter(DailyPhoto.id == photo_id1).first()
    p2 = db.query(DailyPhoto).filter(DailyPhoto.id == photo_id2).first()
    if not p1 or not p2:
        raise HTTPException(404, "照片不存在")
    return {"photo1": p1, "photo2": p2}
