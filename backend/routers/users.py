from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel
from typing import Optional
import hashlib
import secrets

from database import get_db
from models import User, Employee, Task, QuickNote, CalendarMeeting

router = APIRouter()


def hash_password(password: str) -> str:
    """Hash password using SHA-256 with salt"""
    salt = secrets.token_hex(16)
    password_hash = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}${password_hash}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    try:
        salt, stored_hash = hashed_password.split('$')
        password_hash = hashlib.sha256((salt + plain_password).encode()).hexdigest()
        return password_hash == stored_hash
    except:
        return False


class UserLogin(BaseModel):
    username: str
    password: str


class UserRegister(BaseModel):
    username: str
    password: str
    display_name: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    username: str
    display_name: Optional[str] = None
    created_at: datetime
    last_login: datetime

    class Config:
        from_attributes = True


@router.post("/login", response_model=UserResponse)
async def login(data: UserLogin, db: Session = Depends(get_db)):
    """
    Login with username and password.
    """
    username = data.username.strip().lower()
    
    if not username:
        raise HTTPException(status_code=400, detail="שם משתמש נדרש")
    
    if not data.password:
        raise HTTPException(status_code=400, detail="סיסמה נדרשת")
    
    # Check if user exists
    user = db.query(User).filter(User.username == username).first()
    
    if not user:
        raise HTTPException(status_code=401, detail="שם משתמש או סיסמה שגויים")
    
    # Verify password
    if not user.password_hash:
        raise HTTPException(status_code=401, detail="משתמש זה אינו מוגדר עם סיסמה. יש ליצור משתמש חדש.")
    
    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="שם משתמש או סיסמה שגויים")
    
    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()
    db.refresh(user)
    
    return user


@router.post("/register", response_model=UserResponse)
async def register(data: UserRegister, db: Session = Depends(get_db)):
    """
    Register a new user with username and password.
    If user exists without password, set the password.
    """
    username = data.username.strip().lower()
    
    if not username:
        raise HTTPException(status_code=400, detail="שם משתמש נדרש")
    
    if not data.password:
        raise HTTPException(status_code=400, detail="סיסמה נדרשת")
    
    if len(data.password) < 4:
        raise HTTPException(status_code=400, detail="הסיסמה חייבת להכיל לפחות 4 תווים")
    
    # Check if user already exists
    existing_user = db.query(User).filter(User.username == username).first()
    if existing_user:
        # If user exists but has no password, allow setting password
        if not existing_user.password_hash:
            existing_user.password_hash = hash_password(data.password)
            existing_user.last_login = datetime.utcnow()
            if data.display_name:
                existing_user.display_name = data.display_name
            db.commit()
            db.refresh(existing_user)
            return existing_user
        else:
            raise HTTPException(status_code=400, detail="שם משתמש כבר קיים במערכת")
    
    # Create new user
    user = User(
        username=username,
        password_hash=hash_password(data.password),
        display_name=data.display_name or data.username.strip(),
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

