from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Database URL - SQLite file in the backend directory
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./one_on_one.db")

engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False}  # Needed for SQLite
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables"""
    from models import Employee, Meeting, ActionItem, Topic, Task, CalendarMeeting, MeetingPrepNote
    Base.metadata.create_all(bind=engine)


