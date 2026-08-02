"""训练记录 API"""
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.workout import WorkoutRecord

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
def create_workout(data: dict, db: Session = Depends(get_db)):
    """新增训练记录"""
    target = data.get("target_sets") or data.get("sets", 0)
    record = WorkoutRecord(
        date=date.fromisoformat(data["date"]) if data.get("date") else date.today(),
        exercise_name=data["exercise_name"],
        sets=target,
        target_sets=target,
        completed_sets=data.get("completed_sets", 0),
        reps=data.get("reps", 0),
        weight_kg=data.get("weight_kg"),
        notes=data.get("notes"),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.put("/{record_id}")
def update_workout(record_id: int, data: dict, db: Session = Depends(get_db)):
    """修改训练记录"""
    record = db.query(WorkoutRecord).filter(WorkoutRecord.id == record_id).first()
    if not record:
        raise HTTPException(404, "记录不存在")
    for key in ["date", "exercise_name", "sets", "target_sets", "completed_sets", "reps", "weight_kg", "notes"]:
        if key in data:
            val = data[key]
            if key == "date" and val:
                val = date.fromisoformat(val)
            setattr(record, key, val)
    # 同步 target_sets 到 sets（兼容旧字段）
    if "target_sets" in data:
        record.sets = data["target_sets"]
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
