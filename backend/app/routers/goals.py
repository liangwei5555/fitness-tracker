"""改善目标 API"""
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.goal import ImprovementGoal

router = APIRouter(prefix="/api/goals", tags=["goals"])


@router.get("/")
def list_goals(active_only: bool = False, db: Session = Depends(get_db)):
    """目标列表"""
    q = db.query(ImprovementGoal)
    if active_only:
        q = q.filter(ImprovementGoal.is_active == True)  # noqa: E712
    return q.order_by(ImprovementGoal.created_at.desc()).all()


@router.post("/")
def create_goal(data: dict, db: Session = Depends(get_db)):
    """创建新目标"""
    goal = ImprovementGoal(
        goal_name=data["goal_name"],
        target_metric=data["target_metric"],
        initial_value=data.get("initial_value"),
        current_value=data.get("current_value", data.get("initial_value")),
        target_value=data.get("target_value"),
        unit=data.get("unit"),
        description=data.get("description"),
        started_at=date.fromisoformat(data["started_at"]) if data.get("started_at") else date.today(),
        target_date=date.fromisoformat(data["target_date"]) if data.get("target_date") else None,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


@router.put("/{goal_id}")
def update_goal(goal_id: int, data: dict, db: Session = Depends(get_db)):
    """更新目标"""
    goal = db.query(ImprovementGoal).filter(ImprovementGoal.id == goal_id).first()
    if not goal:
        raise HTTPException(404, "目标不存在")
    for key in ["goal_name", "target_metric", "initial_value", "current_value",
                "target_value", "unit", "description", "is_active", "target_date"]:
        if key in data:
            val = data[key]
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
