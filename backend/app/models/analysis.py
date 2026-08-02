"""AI 照片分析结果模型"""
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from app.database import Base


class PhotoAnalysis(Base):
    __tablename__ = "photo_analyses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    photo_id = Column(Integer, ForeignKey("daily_photos.id", ondelete="CASCADE"), nullable=False, unique=True)
    posture_assessment = Column(Text, nullable=True)        # 整体体态评估
    shoulder_diff_cm = Column(Float, nullable=True)          # 高低肩差值(cm)
    spine_alignment = Column(String(100), nullable=True)     # 脊柱评估
    pelvis_tilt = Column(String(100), nullable=True)         # 骨盆评估
    recommendations = Column(Text, nullable=True)            # 改善建议
    raw_response = Column(Text, nullable=True)               # Claude 原始返回
    analyzed_at = Column(DateTime, server_default=func.now())
