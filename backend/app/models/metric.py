"""身体测量数据模型"""
from datetime import date as date_type
from sqlalchemy import Column, Integer, Float, Date, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base


class BodyMetric(Base):
    __tablename__ = "body_metrics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(Date, nullable=False, default=date_type.today, index=True)
    weight_kg = Column(Float, nullable=True)
    shoulder_height_diff_cm = Column(Float, nullable=True)  # 手动测量高低肩差值
    waist_cm = Column(Float, nullable=True)
    chest_cm = Column(Float, nullable=True)
    arm_cm = Column(Float, nullable=True)
    thigh_cm = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
