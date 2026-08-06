"""笔记 API"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.models.note import Note

router = APIRouter(prefix="/api/notes", tags=["notes"])


class NoteCreate(BaseModel):
    title: str
    content: str = ""


class NoteUpdate(BaseModel):
    title: str | None = None
    content: str | None = None


@router.get("/")
def list_notes(db: Session = Depends(get_db)):
    """笔记列表（按更新时间倒序）"""
    return db.query(Note).order_by(Note.updated_at.desc()).all()


@router.get("/{note_id}")
def get_note(note_id: int, db: Session = Depends(get_db)):
    """获取单条笔记"""
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(404, "笔记不存在")
    return note


@router.post("/")
def create_note(data: NoteCreate, db: Session = Depends(get_db)):
    """新建笔记"""
    note = Note(title=data.title.strip(), content=data.content)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.put("/{note_id}")
def update_note(note_id: int, data: NoteUpdate, db: Session = Depends(get_db)):
    """编辑笔记"""
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(404, "笔记不存在")
    if data.title is not None:
        note.title = data.title.strip()
    if data.content is not None:
        note.content = data.content
    db.commit()
    db.refresh(note)
    return note


@router.delete("/{note_id}")
def delete_note(note_id: int, db: Session = Depends(get_db)):
    """删除笔记"""
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(404, "笔记不存在")
    db.delete(note)
    db.commit()
    return {"ok": True}
