"""改善目标 API"""
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.goal import ImprovementGoal


class GoalCreate(BaseModel):
    goal_name: str
    target_metric: str
    initial_value: Optional[float] = None
    current_value: Optional[float] = None
    target_value: Optional[float] = None
    unit: Optional[str] = None
    description: Optional[str] = None
    started_at: Optional[str] = None
    target_date: Optional[str] = None


class GoalUpdate(BaseModel):
    goal_name: Optional[str] = None
    target_metric: Optional[str] = None
    initial_value: Optional[float] = None
    current_value: Optional[float] = None
    target_value: Optional[float] = None
    unit: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    started_at: Optional[str] = None
    target_date: Optional[str] = None


router = APIRouter(prefix="/api/goals", tags=["goals"])


@router.get("/")
def list_goals(active_only: bool = False, db: Session = Depends(get_db)):
    """目标列表"""
    q = db.query(ImprovementGoal)
    if active_only:
        q = q.filter(ImprovementGoal.is_active == True)  # noqa: E712
    return q.order_by(ImprovementGoal.created_at.desc()).all()


@router.post("/")
def create_goal(data: GoalCreate, db: Session = Depends(get_db)):
    """创建新目标"""
    goal = ImprovementGoal(
        goal_name=data.goal_name,
        target_metric=data.target_metric,
        initial_value=data.initial_value,
        current_value=data.current_value or data.initial_value,
        target_value=data.target_value,
        unit=data.unit,
        description=data.description,
        started_at=date.fromisoformat(data.started_at) if data.started_at else date.today(),
        target_date=date.fromisoformat(data.target_date) if data.target_date else None,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


@router.put("/{goal_id}")
def update_goal(goal_id: int, data: GoalUpdate, db: Session = Depends(get_db)):
    """更新目标"""
    goal = db.query(ImprovementGoal).filter(ImprovementGoal.id == goal_id).first()
    if not goal:
        raise HTTPException(404, "目标不存在")
    updates = data.model_dump(exclude_unset=True)
    for key, val in updates.items():
        if key in ("started_at", "target_date") and val:
            val = date.fromisoformat(val)
        setattr(goal, key, val)
    db.commit()
    db.refresh(goal)
    return goal


@router.get("/{goal_id}/report")
def get_goal_report(goal_id: int, db: Session = Depends(get_db)):
    """单个目标的改善报告"""
    goal = db.query(ImprovementGoal).filter(ImprovementGoal.id == goal_id).first()
    if not goal:
        raise HTTPException(404, "目标不存在")

    progress_pct = None
    if goal.initial_value is not None and goal.target_value is not None and goal.current_value is not None:
        total_change = goal.target_value - goal.initial_value
        current_change = goal.current_value - goal.initial_value
        if total_change != 0:
            progress_pct = round(current_change / total_change * 100, 1)

    return {
        "goal": goal,
        "progress_pct": progress_pct,
        "days_elapsed": (date.today() - goal.started_at).days if goal.started_at else 0,
    }
