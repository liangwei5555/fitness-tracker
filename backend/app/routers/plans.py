"""训练计划 API"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from app.database import get_db
from app.models.plan import TrainingPlan, PlanExercise
from app.models.workout import WorkoutRecord

router = APIRouter(prefix="/api/plans", tags=["plans"])


class PlanExerciseData(BaseModel):
    exercise_name: str
    target_sets: int = 0
    reps: int = 0
    weight_kg: float | None = None


class PlanCreate(BaseModel):
    name: str
    exercises: list[PlanExerciseData]


class PlanApply(BaseModel):
    date: str


@router.get("/")
def list_plans(db: Session = Depends(get_db)):
    """列出所有训练计划（含动作）"""
    plans = db.query(TrainingPlan).options(joinedload(TrainingPlan.exercises)).order_by(TrainingPlan.created_at.desc()).all()
    return plans


@router.post("/")
def create_plan(data: PlanCreate, db: Session = Depends(get_db)):
    """创建训练计划"""
    if not data.name.strip():
        raise HTTPException(400, "计划名称不能为空")
    plan = TrainingPlan(name=data.name.strip())
    db.add(plan)
    db.flush()
    for i, ex in enumerate(data.exercises):
        db.add(PlanExercise(
            plan_id=plan.id,
            exercise_name=ex.exercise_name,
            target_sets=ex.target_sets,
            reps=ex.reps,
            weight_kg=ex.weight_kg,
            sort_order=i,
        ))
    db.commit()
    db.refresh(plan)
    return plan


@router.post("/{plan_id}/apply")
def apply_plan(plan_id: int, data: PlanApply, db: Session = Depends(get_db)):
    """将计划应用到指定日期"""
    from datetime import date
    plan = db.query(TrainingPlan).options(joinedload(TrainingPlan.exercises)).filter(TrainingPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(404, "计划不存在")

    session_date = date.fromisoformat(data.date)
    count = 0
    for ex in sorted(plan.exercises, key=lambda e: e.sort_order):
        db.add(WorkoutRecord(
            date=session_date,
            exercise_name=ex.exercise_name,
            target_sets=ex.target_sets,
            sets=ex.target_sets,
            reps=ex.reps,
            weight_kg=ex.weight_kg,
        ))
        count += 1
    db.commit()
    return {"ok": True, "applied": count}


@router.delete("/{plan_id}")
def delete_plan(plan_id: int, db: Session = Depends(get_db)):
    """删除训练计划"""
    plan = db.query(TrainingPlan).filter(TrainingPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(404, "计划不存在")
    db.delete(plan)
    db.commit()
    return {"ok": True}
