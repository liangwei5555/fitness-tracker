"""训练计时 API"""
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.models.session import WorkoutSession

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


class SessionSave(BaseModel):
    date: str
    duration_seconds: int


@router.get("/{session_date}")
def get_session(session_date: str, db: Session = Depends(get_db)):
    """获取某天的训练时长（秒）"""
    s = db.query(WorkoutSession).filter(WorkoutSession.date == date.fromisoformat(session_date)).first()
    if not s:
        return {"date": session_date, "duration_seconds": 0}
    return {"date": str(s.date), "duration_seconds": s.duration_seconds}


@router.post("/")
def save_session(data: SessionSave, db: Session = Depends(get_db)):
    """保存训练时长（按日期 upsert，累加时长）"""
    session_date = date.fromisoformat(data.date)
    s = db.query(WorkoutSession).filter(WorkoutSession.date == session_date).first()

    if s:
        s.duration_seconds += data.duration_seconds
    else:
        s = WorkoutSession(date=session_date, duration_seconds=data.duration_seconds)
        db.add(s)

    db.commit()
    db.refresh(s)
    return {"date": str(s.date), "duration_seconds": s.duration_seconds}


@router.delete("/{session_date}")
def delete_session(session_date: str, db: Session = Depends(get_db)):
    """删除某天的训练时长"""
    s = db.query(WorkoutSession).filter(WorkoutSession.date == date.fromisoformat(session_date)).first()
    if not s:
        raise HTTPException(404, "该日期无训练时长记录")
    db.delete(s)
    db.commit()
    return {"ok": True}


@router.get("/")
def list_sessions(
    date_from: str | None = None,
    date_to: str | None = None,
    db: Session = Depends(get_db),
):
    """列出训练时长记录"""
    q = db.query(WorkoutSession)
    if date_from:
        q = q.filter(WorkoutSession.date >= date.fromisoformat(date_from))
    if date_to:
        q = q.filter(WorkoutSession.date <= date.fromisoformat(date_to))
    return q.order_by(WorkoutSession.date.desc()).all()
