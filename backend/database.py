from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Database URL - PostgreSQL for production, SQLite for local development
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./one_on_one.db")

# Railway uses postgres:// but SQLAlchemy needs postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Configure engine based on database type
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL, 
        connect_args={"check_same_thread": False}  # Needed for SQLite
    )
else:
    # PostgreSQL configuration
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,  # Test connections before using
        pool_size=5,
        max_overflow=10
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
    from models import User, Employee, Meeting, ActionItem, Topic, Task, CalendarMeeting, MeetingPrepNote, QuickNote
    Base.metadata.create_all(bind=engine)
