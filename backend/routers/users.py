from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models import User, Employee, Task, QuickNote, CalendarMeeting

router = APIRouter()


class UserLogin(BaseModel):
    username: str


class UserResponse(BaseModel):
    id: int
    username: str
    display_name: Optional[str] = None
    created_at: datetime
    last_login: datetime

    class Config:
        from_attributes = True


@router.post("/login", response_model=UserResponse)
async def login_or_register(data: UserLogin, db: Session = Depends(get_db)):
    """
    Login with username - creates user if doesn't exist.
    No password required.
    """
    username = data.username.strip().lower()
    
    if not username:
        raise HTTPException(status_code=400, detail="שם משתמש נדרש")
    
    # Check if user exists
    user = db.query(User).filter(User.username == username).first()
    
    if user:
        # Update last login
        user.last_login = datetime.utcnow()
        db.commit()
        db.refresh(user)
    else:
        # Create new user
        user = User(
            username=username,
            display_name=data.username.strip(),  # Keep original casing for display
            created_at=datetime.utcnow(),
            last_login=datetime.utcnow()
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    return user


@router.get("/me", response_model=UserResponse)
async def get_current_user(user_id: int, db: Session = Depends(get_db)):
    """Get user by ID"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="משתמש לא נמצא")
    return user


@router.get("/check/{username}")
async def check_username(username: str, db: Session = Depends(get_db)):
    """Check if username exists"""
    username_lower = username.strip().lower()
    user = db.query(User).filter(User.username == username_lower).first()
    return {"exists": user is not None, "user": UserResponse.from_orm(user) if user else None}


@router.post("/migrate-data/{user_id}")
async def migrate_existing_data(user_id: int, db: Session = Depends(get_db)):
    """
    Migrate all existing data (with no user_id) to the specified user.
    This is a one-time migration endpoint.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="משתמש לא נמצא")
    
    # Migrate employees
    employees_count = db.query(Employee).filter(Employee.user_id == None).update(
        {"user_id": user_id}, synchronize_session=False
    )
    
    # Migrate tasks
    tasks_count = db.query(Task).filter(Task.user_id == None).update(
        {"user_id": user_id}, synchronize_session=False
    )
    
    # Migrate quick notes
    notes_count = db.query(QuickNote).filter(QuickNote.user_id == None).update(
        {"user_id": user_id}, synchronize_session=False
    )
    
    # Migrate calendar meetings
    calendar_count = db.query(CalendarMeeting).filter(CalendarMeeting.user_id == None).update(
        {"user_id": user_id}, synchronize_session=False
    )
    
    db.commit()
    
    return {
        "message": "Data migrated successfully",
        "migrated": {
            "employees": employees_count,
            "tasks": tasks_count,
            "quick_notes": notes_count,
            "calendar_meetings": calendar_count
        }
    }

