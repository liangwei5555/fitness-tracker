"""改善目标模型"""
from sqlalchemy import Column, Integer, String, Float, Date, Text, DateTime, Boolean
from sqlalchemy.sql import func
from app.database import Base


class ImprovementGoal(Base):
    __tablename__ = "improvement_goals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    goal_name = Column(String(200), nullable=False)
    target_metric = Column(String(100), nullable=False)       # 追踪指标名称
    initial_value = Column(Float, nullable=True)              # 初始值
    current_value = Column(Float, nullable=True)              # 当前值
    target_value = Column(Float, nullable=True)               # 目标值
    unit = Column(String(20), nullable=True)                  # 单位(cm, kg等)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)                 # 是否活跃
    started_at = Column(Date, nullable=False)
    target_date = Column(Date, nullable=True)                 # 目标达成日期
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
