"""训练记录模型"""
from datetime import date as date_type
from sqlalchemy import Column, Integer, String, Float, Date, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base


class WorkoutRecord(Base):
    __tablename__ = "workout_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(Date, nullable=False, default=date_type.today, index=True)
    exercise_name = Column(String(100), nullable=False)
    sets = Column(Integer, nullable=False, default=0)  # 保留兼容
    target_sets = Column(Integer, nullable=False, default=0)  # 计划组数
    completed_sets = Column(Integer, nullable=False, default=0)  # 已完成组数
    reps = Column(Integer, nullable=False, default=0)
    weight_kg = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
