"""训练计划模板"""
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class TrainingPlan(Base):
    __tablename__ = "training_plans"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    exercises = relationship("PlanExercise", back_populates="plan", order_by="PlanExercise.sort_order",
                             cascade="all, delete-orphan")


class PlanExercise(Base):
    __tablename__ = "plan_exercises"

    id = Column(Integer, primary_key=True, autoincrement=True)
    plan_id = Column(Integer, ForeignKey("training_plans.id", ondelete="CASCADE"), nullable=False)
    exercise_name = Column(String(100), nullable=False)
    target_sets = Column(Integer, nullable=False, default=0)
    reps = Column(Integer, nullable=False, default=0)
    weight_kg = Column(Float, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)

    plan = relationship("TrainingPlan", back_populates="exercises")
