"""训练计时模型"""
from datetime import date as date_type
from sqlalchemy import Column, Integer, Date, DateTime
from sqlalchemy.sql import func
from app.database import Base


class WorkoutSession(Base):
    __tablename__ = "workout_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(Date, nullable=False, default=date_type.today, unique=True, index=True)
    duration_seconds = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
