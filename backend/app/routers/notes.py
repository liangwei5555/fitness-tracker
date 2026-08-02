"""每日总结 API"""
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.note import DailyNote

router = APIRouter(prefix="/api/notes", tags=["notes"])


@router.get("/")
def list_notes(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """每日总结列表"""
    q = db.query(DailyNote)
    if date_from:
        q = q.filter(DailyNote.date >= date.fromisoformat(date_from))
    if date_to:
        q = q.filter(DailyNote.date <= date.fromisoformat(date_to))
    q = q.order_by(DailyNote.date.desc())
    return q.limit(60).all()


@router.get("/{note_date}")
def get_note(note_date: str, db: Session = Depends(get_db)):
    """获取某天的总结"""
    note = (
        db.query(DailyNote)
        .filter(DailyNote.date == date.fromisoformat(note_date))
        .first()
    )
    if not note:
        raise HTTPException(404, "该日期无总结记录")
    return note


@router.post("/")
def create_or_update_note(data: dict, db: Session = Depends(get_db)):
    """创建或更新每日总结（按日期 upsert）"""
    note_date = date.fromisoformat(data["date"]) if data.get("date") else date.today()

    existing = db.query(DailyNote).filter(DailyNote.date == note_date).first()
    if existing:
        for key in ["mood", "sleep_hours", "diet_notes", "overall_notes"]:
            if key in data:
                setattr(existing, key, data[key])
        db.commit()
        db.refresh(existing)
        return existing

    note = DailyNote(
        date=note_date,
        mood=data.get("mood"),
        sleep_hours=data.get("sleep_hours"),
        diet_notes=data.get("diet_notes"),
        overall_notes=data.get("overall_notes"),
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note
