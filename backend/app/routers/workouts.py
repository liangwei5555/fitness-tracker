"""训练记录 API"""
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.workout import WorkoutRecord


class WorkoutCreate(BaseModel):
    date: str
    exercise_name: str
    sets: int = 0
    target_sets: int = 0
    completed_sets: int = 0
    reps: int = 0
    weight_kg: Optional[float] = None
    notes: Optional[str] = None


class WorkoutUpdate(BaseModel):
    date: Optional[str] = None
    exercise_name: Optional[str] = None
    sets: Optional[int] = None
    target_sets: Optional[int] = None
    completed_sets: Optional[int] = None
    reps: Optional[int] = None
    weight_kg: Optional[float] = None
    notes: Optional[str] = None


router = APIRouter(prefix="/api/workouts", tags=["workouts"])


@router.get("/")
def list_workouts(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    exercise_name: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """获取训练记录列表，支持日期和动作筛选"""
    q = db.query(WorkoutRecord)
    if date_from:
        q = q.filter(WorkoutRecord.date >= date.fromisoformat(date_from))
    if date_to:
        q = q.filter(WorkoutRecord.date <= date.fromisoformat(date_to))
    if exercise_name:
        q = q.filter(WorkoutRecord.exercise_name.ilike(f"%{exercise_name}%"))
    q = q.order_by(WorkoutRecord.date.desc(), WorkoutRecord.created_at.desc())
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return {"data": items, "total": total, "page": page, "page_size": page_size}


@router.post("/")
def create_workout(data: WorkoutCreate, db: Session = Depends(get_db)):
    """新增训练记录"""
    record = WorkoutRecord(
        date=date.fromisoformat(data.date) if data.date else date.today(),
        exercise_name=data.exercise_name,
        sets=data.target_sets or data.sets,
        target_sets=data.target_sets or data.sets,
        completed_sets=data.completed_sets,
        reps=data.reps,
        weight_kg=data.weight_kg,
        notes=data.notes,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.put("/{record_id}")
def update_workout(record_id: int, data: WorkoutUpdate, db: Session = Depends(get_db)):
    """修改训练记录"""
    record = db.query(WorkoutRecord).filter(WorkoutRecord.id == record_id).first()
    if not record:
        raise HTTPException(404, "记录不存在")
    updates = data.model_dump(exclude_unset=True)
    for key, val in updates.items():
        if key == "date" and val:
            val = date.fromisoformat(val)
        setattr(record, key, val)
    # 同步 target_sets 到 sets
    if "target_sets" in updates:
        record.sets = updates["target_sets"]
    db.commit()
    db.refresh(record)
    return record


@router.post("/{record_id}/complete-set")
def complete_set(record_id: int, db: Session = Depends(get_db)):
    """完成一组训练"""
    record = db.query(WorkoutRecord).filter(WorkoutRecord.id == record_id).first()
    if not record:
        raise HTTPException(404, "记录不存在")
    target = record.target_sets or record.sets
    if record.completed_sets >= target:
        return record  # already done
    record.completed_sets += 1
    db.commit()
    db.refresh(record)
    return record


@router.post("/{record_id}/undo-set")
def undo_set(record_id: int, db: Session = Depends(get_db)):
    """撤销一组训练"""
    record = db.query(WorkoutRecord).filter(WorkoutRecord.id == record_id).first()
    if not record:
        raise HTTPException(404, "记录不存在")
    if record.completed_sets <= 0:
        return record
    record.completed_sets -= 1
    db.commit()
    db.refresh(record)
    return record


@router.delete("/{record_id}")
def delete_workout(record_id: int, db: Session = Depends(get_db)):
    """删除训练记录"""
    record = db.query(WorkoutRecord).filter(WorkoutRecord.id == record_id).first()
    if not record:
        raise HTTPException(404, "记录不存在")
    db.delete(record)
    db.commit()
    return {"ok": True}
