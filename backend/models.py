from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from database import Base


class MoodLevel(enum.Enum):
    VERY_LOW = 1
    LOW = 2
    NEUTRAL = 3
    GOOD = 4
    EXCELLENT = 5


class ActionItemStatus(enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class PersonType(enum.Enum):
    EMPLOYEE = "employee"      # עובד כפוף
    COLLEAGUE = "colleague"    # קולגה/עמית
    MANAGER = "manager"        # מנהל שלי


class TaskType(enum.Enum):
    PERSONAL = "personal"           # משימה אישית שלי
    DISCUSS_WITH = "discuss_with"   # נושא לדיון עם מישהו
    FROM_MEETING = "from_meeting"   # נוצר מישיבה


class TaskPriority(enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class TaskStatus(enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    role = Column(String(100))
    department = Column(String(100))
    email = Column(String(100))
    start_date = Column(DateTime)
    notes = Column(Text)
    person_type = Column(String(20), default="employee")  # employee, colleague, or manager
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    # Relationships
    meetings = relationship("Meeting", back_populates="employee", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="person", cascade="all, delete-orphan")


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    date = Column(DateTime, nullable=False)
    duration_minutes = Column(Integer, default=30)
    
    # Meeting content
    notes = Column(Text)
    summary = Column(Text)
    
    
    # AI-generated insights
    ai_insights = Column(Text)
    ai_topics = Column(Text)  # JSON string of extracted topics
    ai_sentiment = Column(String(50))  # positive, neutral, negative
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    employee = relationship("Employee", back_populates="meetings")
    action_items = relationship("ActionItem", back_populates="meeting", cascade="all, delete-orphan")
    topics = relationship("Topic", back_populates="meeting", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="meeting")


class ActionItem(Base):
    __tablename__ = "action_items"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False)
    description = Column(Text, nullable=False)
    assignee = Column(String(100))  # "manager" or "employee"
    due_date = Column(DateTime)
    status = Column(String(20), default="pending")
    completed_at = Column(DateTime)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    meeting = relationship("Meeting", back_populates="action_items")


class Topic(Base):
    __tablename__ = "topics"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False)
    name = Column(String(100), nullable=False)
    category = Column(String(50))  # career, feedback, blockers, personal, project, etc.
    sentiment = Column(String(20))  # positive, neutral, negative
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    meeting = relationship("Meeting", back_populates="topics")


class CalendarMeeting(Base):
    """ישיבות מהיומן - מסונכרנות או ידניות"""
    __tablename__ = "calendar_meetings"

    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(String(255), nullable=True, unique=True)  # Google Calendar event ID
    title = Column(String(300), nullable=False)
    description = Column(Text)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    location = Column(String(300))
    attendees = Column(Text)  # JSON list of attendees
    calendar_source = Column(String(50), default="manual")  # google, outlook, manual
    is_recurring = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    prep_notes = relationship("MeetingPrepNote", back_populates="calendar_meeting", cascade="all, delete-orphan")


class MeetingPrepNote(Base):
    """נקודות להכנה לישיבה"""
    __tablename__ = "meeting_prep_notes"

    id = Column(Integer, primary_key=True, index=True)
    calendar_meeting_id = Column(Integer, ForeignKey("calendar_meetings.id"), nullable=False)
    content = Column(Text, nullable=False)
    is_completed = Column(Boolean, default=False)
    order_index = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    calendar_meeting = relationship("CalendarMeeting", back_populates="prep_notes")


class Task(Base):
    """משימות - אישיות, לדיון, או מישיבה"""
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    
    # Task classification
    task_type = Column(String(20), default="personal")  # personal, discuss_with, from_meeting
    priority = Column(String(10), default="medium")  # low, medium, high
    status = Column(String(20), default="pending")  # pending, in_progress, completed, cancelled
    
    # Optional associations
    person_id = Column(Integer, ForeignKey("employees.id"), nullable=True)  # אם קשור לאדם
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=True)  # אם נוצר מישיבה
    
    # Dates
    due_date = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    person = relationship("Employee", back_populates="tasks")
    meeting = relationship("Meeting", back_populates="tasks")


class NoteCategory(enum.Enum):
    GENERAL = "general"       # כללי
    LINK = "link"            # קישור
    CREDENTIAL = "credential" # פרטי גישה
    CONTACT = "contact"       # איש קשר
    SNIPPET = "snippet"       # קטע קוד/טקסט


class QuickNote(Base):
    """פתקים מהירים לשמירת מידע חשוב"""
    __tablename__ = "quick_notes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String(20), default="general")  # general, link, credential, contact, snippet
    
    # Optional: link to a person
    person_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    
    # For pinning important notes
    is_pinned = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    person = relationship("Employee")


