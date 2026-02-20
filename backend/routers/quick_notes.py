"""
Quick Notes API - פתקים מהירים לשמירת מידע חשוב
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

from database import get_db
from models import QuickNote

router = APIRouter()


# ============== Schemas ==============

class QuickNoteBase(BaseModel):
    title: str
    content: str
    category: str = "general"
    person_id: Optional[int] = None
    is_pinned: bool = False


class QuickNoteCreate(QuickNoteBase):
    pass


class QuickNoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    person_id: Optional[int] = None
    is_pinned: Optional[bool] = None


class QuickNoteResponse(QuickNoteBase):
    id: int
    created_at: datetime
    updated_at: datetime
    person_name: Optional[str] = None

    class Config:
        from_attributes = True


class QuickNotesListResponse(BaseModel):
    notes: List[QuickNoteResponse]
    total: int


# ============== Endpoints ==============

@router.get("/", response_model=QuickNotesListResponse)
async def get_quick_notes(
    category: Optional[str] = Query(None, description="Filter by category"),
    person_id: Optional[int] = Query(None, description="Filter by person"),
    search: Optional[str] = Query(None, description="Search in title and content"),
    pinned_only: bool = Query(False, description="Show only pinned notes"),
    db: Session = Depends(get_db)
):
    """קבלת כל הפתקים"""
    query = db.query(QuickNote)
    
    if category:
        query = query.filter(QuickNote.category == category)
    
    if person_id:
        query = query.filter(QuickNote.person_id == person_id)
    
    if pinned_only:
        query = query.filter(QuickNote.is_pinned == True)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (QuickNote.title.ilike(search_term)) | 
            (QuickNote.content.ilike(search_term))
        )
    
    # Order: pinned first, then by updated_at
    notes = query.order_by(desc(QuickNote.is_pinned), desc(QuickNote.updated_at)).all()
    
    # Add person names
    result = []
    for note in notes:
        note_dict = {
            "id": note.id,
            "title": note.title,
            "content": note.content,
            "category": note.category,
            "person_id": note.person_id,
            "is_pinned": note.is_pinned,
            "created_at": note.created_at,
            "updated_at": note.updated_at,
            "person_name": note.person.name if note.person else None
        }
        result.append(QuickNoteResponse(**note_dict))
    
    return QuickNotesListResponse(notes=result, total=len(result))


@router.get("/{note_id}", response_model=QuickNoteResponse)
async def get_quick_note(note_id: int, db: Session = Depends(get_db)):
    """קבלת פתק ספציפי"""
    note = db.query(QuickNote).filter(QuickNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    return QuickNoteResponse(
        id=note.id,
        title=note.title,
        content=note.content,
        category=note.category,
        person_id=note.person_id,
        is_pinned=note.is_pinned,
        created_at=note.created_at,
        updated_at=note.updated_at,
        person_name=note.person.name if note.person else None
    )


@router.post("/", response_model=QuickNoteResponse)
async def create_quick_note(note: QuickNoteCreate, db: Session = Depends(get_db)):
    """יצירת פתק חדש"""
    db_note = QuickNote(
        title=note.title,
        content=note.content,
        category=note.category,
        person_id=note.person_id,
        is_pinned=note.is_pinned
    )
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    
    return QuickNoteResponse(
        id=db_note.id,
        title=db_note.title,
        content=db_note.content,
        category=db_note.category,
        person_id=db_note.person_id,
        is_pinned=db_note.is_pinned,
        created_at=db_note.created_at,
        updated_at=db_note.updated_at,
        person_name=db_note.person.name if db_note.person else None
    )


@router.put("/{note_id}", response_model=QuickNoteResponse)
async def update_quick_note(
    note_id: int,
    note: QuickNoteUpdate,
    db: Session = Depends(get_db)
):
    """עדכון פתק"""
    db_note = db.query(QuickNote).filter(QuickNote.id == note_id).first()
    if not db_note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    update_data = note.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_note, field, value)
    
    db.commit()
    db.refresh(db_note)
    
    return QuickNoteResponse(
        id=db_note.id,
        title=db_note.title,
        content=db_note.content,
        category=db_note.category,
        person_id=db_note.person_id,
        is_pinned=db_note.is_pinned,
        created_at=db_note.created_at,
        updated_at=db_note.updated_at,
        person_name=db_note.person.name if db_note.person else None
    )


@router.post("/{note_id}/toggle-pin", response_model=QuickNoteResponse)
async def toggle_pin(note_id: int, db: Session = Depends(get_db)):
    """הצמדה/ביטול הצמדה של פתק"""
    db_note = db.query(QuickNote).filter(QuickNote.id == note_id).first()
    if not db_note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    db_note.is_pinned = not db_note.is_pinned
    db.commit()
    db.refresh(db_note)
    
    return QuickNoteResponse(
        id=db_note.id,
        title=db_note.title,
        content=db_note.content,
        category=db_note.category,
        person_id=db_note.person_id,
        is_pinned=db_note.is_pinned,
        created_at=db_note.created_at,
        updated_at=db_note.updated_at,
        person_name=db_note.person.name if db_note.person else None
    )


@router.delete("/{note_id}")
async def delete_quick_note(note_id: int, db: Session = Depends(get_db)):
    """מחיקת פתק"""
    db_note = db.query(QuickNote).filter(QuickNote.id == note_id).first()
    if not db_note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    db.delete(db_note)
    db.commit()
    return {"message": "Note deleted successfully"}

