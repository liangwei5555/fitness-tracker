"""AI 分析 API"""
import os
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.photo import DailyPhoto
from app.models.analysis import PhotoAnalysis
from app.services.analyze_service import analyze_photo

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


@router.post("/{photo_id}")
def trigger_analysis(photo_id: int, db: Session = Depends(get_db)):
    """对指定照片触发 AI 分析"""
    photo = db.query(DailyPhoto).filter(DailyPhoto.id == photo_id).first()
    if not photo:
        raise HTTPException(404, "照片不存在")

    # 检查是否已经分析过
    existing = db.query(PhotoAnalysis).filter(PhotoAnalysis.photo_id == photo_id).first()
    if existing:
        return {"message": "该照片已分析过", "analysis": existing}

    # 读取照片文件
    photo_path = os.path.join(BACKEND_DIR, "data", photo.file_path)
    if not os.path.isfile(photo_path):
        raise HTTPException(404, "照片文件不存在")

    # 调用 Claude API 分析
    result = analyze_photo(photo_path, photo.view_type)

    analysis = PhotoAnalysis(
        photo_id=photo_id,
        posture_assessment=result.get("posture_assessment"),
        shoulder_diff_cm=result.get("shoulder_diff_cm"),
        spine_alignment=result.get("spine_alignment"),
        pelvis_tilt=result.get("pelvis_tilt"),
        recommendations=result.get("recommendations"),
        raw_response=result.get("raw_response"),
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return analysis


@router.get("/{photo_id}")
def get_analysis(photo_id: int, db: Session = Depends(get_db)):
    """获取某张照片的分析结果"""
    analysis = db.query(PhotoAnalysis).filter(PhotoAnalysis.photo_id == photo_id).first()
    if not analysis:
        raise HTTPException(404, "该照片尚未分析")
    return analysis


@router.get("/")
def get_latest(db: Session = Depends(get_db)):
    """获取最新分析摘要"""
    latest = (
        db.query(PhotoAnalysis)
        .order_by(PhotoAnalysis.analyzed_at.desc())
        .first()
    )
    return latest


@router.get("/trend")
def get_trend(db: Session = Depends(get_db)):
    """获取体态变化趋势数据"""
    analyses = (
        db.query(PhotoAnalysis)
        .join(DailyPhoto, PhotoAnalysis.photo_id == DailyPhoto.id)
        .order_by(DailyPhoto.date.asc())
        .all()
    )
    trend = []
    for a in analyses:
        photo = db.query(DailyPhoto).filter(DailyPhoto.id == a.photo_id).first()
        trend.append({
            "date": str(photo.date) if photo else None,
            "shoulder_diff_cm": a.shoulder_diff_cm,
            "posture_assessment": a.posture_assessment,
            "spine_alignment": a.spine_alignment,
            "photo_id": a.photo_id,
        })
    return trend
