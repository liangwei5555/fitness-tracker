"""每日照片模型"""
from datetime import date as date_type
from sqlalchemy import Column, Integer, String, Date, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base


class DailyPhoto(Base):
    __tablename__ = "daily_photos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(Date, nullable=False, default=date_type.today, index=True)
    file_path = Column(String(500), nullable=False)
    view_type = Column(String(20), nullable=False, default="正面")  # 正面/背面/侧面
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
