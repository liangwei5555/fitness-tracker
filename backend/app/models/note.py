"""每日总结模型"""
from datetime import date as date_type
from sqlalchemy import Column, Integer, String, Float, Date, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base


class DailyNote(Base):
    __tablename__ = "daily_notes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(Date, nullable=False, default=date_type.today, unique=True, index=True)
    mood = Column(String(20), nullable=True)            # 😊/😐/😞
    sleep_hours = Column(Float, nullable=True)
    diet_notes = Column(Text, nullable=True)
    overall_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
