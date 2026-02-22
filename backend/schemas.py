from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


# ============== Employee/Person Schemas ==============

class EmployeeBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    role: Optional[str] = None
    department: Optional[str] = None
    email: Optional[str] = None
    start_date: Optional[datetime] = None
    notes: Optional[str] = None
    person_type: str = "employee"  # employee or colleague


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    role: Optional[str] = None
    department: Optional[str] = None
    email: Optional[str] = None
    start_date: Optional[datetime] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None
    person_type: Optional[str] = None


class EmployeeResponse(EmployeeBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    meeting_count: Optional[int] = 0
    last_meeting_date: Optional[datetime] = None
    pending_discussion_topics: Optional[int] = 0

    class Config:
        from_attributes = True


# ============== Action Item Schemas ==============

class ActionItemBase(BaseModel):
    description: str = Field(..., min_length=1)
    assignee: Optional[str] = None
    due_date: Optional[datetime] = None
    status: str = "pending"
    notes: Optional[str] = None


class ActionItemCreate(ActionItemBase):
    pass


class ActionItemUpdate(BaseModel):
    description: Optional[str] = None
    assignee: Optional[str] = None
    due_date: Optional[datetime] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class ActionItemResponse(ActionItemBase):
    id: int
    meeting_id: int
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============== Topic Schemas ==============

class TopicBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    category: Optional[str] = None
    sentiment: Optional[str] = None
    notes: Optional[str] = None


class TopicCreate(TopicBase):
    pass


class TopicResponse(TopicBase):
    id: int
    meeting_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ============== Meeting Schemas ==============

class MeetingBase(BaseModel):
    date: datetime
    duration_minutes: int = 30
    notes: Optional[str] = None
    summary: Optional[str] = None


class MeetingCreate(MeetingBase):
    employee_id: int
    action_items: Optional[List[ActionItemCreate]] = []
    topics: Optional[List[TopicCreate]] = []


class MeetingUpdate(BaseModel):
    date: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    notes: Optional[str] = None
    summary: Optional[str] = None


class MeetingResponse(MeetingBase):
    id: int
    employee_id: int
    ai_insights: Optional[str] = None
    ai_topics: Optional[str] = None
    ai_sentiment: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    action_items: List[ActionItemResponse] = []
    topics: List[TopicResponse] = []
    employee_name: Optional[str] = None

    class Config:
        from_attributes = True


# ============== Analytics Schemas ==============

class TopicFrequency(BaseModel):
    topic: str
    count: int
    category: Optional[str] = None


class EmployeeAnalytics(BaseModel):
    employee_id: int
    employee_name: str
    total_meetings: int
    top_topics: List[TopicFrequency] = []
    pending_action_items: int = 0
    completed_action_items: int = 0


class OverallAnalytics(BaseModel):
    total_employees: int
    total_meetings: int
    top_topics: List[TopicFrequency] = []
    sentiment_distribution: dict = {}
    meetings_per_month: dict = {}


class AIAnalysisRequest(BaseModel):
    meeting_id: int
    notes: str


class AIAnalysisResponse(BaseModel):
    insights: str
    topics: List[str]
    sentiment: str
    action_items_suggested: List[str] = []


# ============== Task Schemas ==============

class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    task_type: str = "personal"  # personal, discuss_with, from_meeting
    priority: str = "medium"  # low, medium, high
    due_date: Optional[datetime] = None


class TaskCreate(TaskBase):
    person_id: Optional[int] = None  # אם קשור לאדם ספציפי
    meeting_id: Optional[int] = None  # אם נוצר מישיבה


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    task_type: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[datetime] = None
    person_id: Optional[int] = None
    meeting_id: Optional[int] = None


class TaskResponse(TaskBase):
    id: int
    status: str
    person_id: Optional[int] = None
    meeting_id: Optional[int] = None
    person_name: Optional[str] = None  # שם האדם הקשור
    assigned_by: Optional[str] = None  # שם המשתמש שיצר את המשימה
    assigned_by_id: Optional[int] = None  # ID של המשתמש שיצר את המשימה
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TasksListResponse(BaseModel):
    tasks: List[TaskResponse]
    total: int
    pending: int
    in_progress: int
    completed: int


class ExtractTasksRequest(BaseModel):
    notes: str


class ExtractTasksResponse(BaseModel):
    suggested_tasks: List[TaskCreate]


# ============== Calendar Meeting Schemas ==============

class MeetingPrepNoteBase(BaseModel):
    content: str = Field(..., min_length=1)
    is_completed: bool = False
    order_index: int = 0


class MeetingPrepNoteCreate(MeetingPrepNoteBase):
    pass


class MeetingPrepNoteUpdate(BaseModel):
    content: Optional[str] = None
    is_completed: Optional[bool] = None
    order_index: Optional[int] = None


class MeetingPrepNoteResponse(MeetingPrepNoteBase):
    id: int
    calendar_meeting_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CalendarMeetingBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    location: Optional[str] = None
    attendees: Optional[str] = None  # JSON string


class CalendarMeetingCreate(CalendarMeetingBase):
    external_id: Optional[str] = None
    calendar_source: str = "manual"
    is_recurring: bool = False


class CalendarMeetingUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=300)
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    location: Optional[str] = None
    attendees: Optional[str] = None


class CalendarMeetingResponse(CalendarMeetingBase):
    id: int
    external_id: Optional[str] = None
    calendar_source: str
    is_recurring: bool
    prep_notes: List[MeetingPrepNoteResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CalendarMeetingsListResponse(BaseModel):
    meetings: List[CalendarMeetingResponse]
    total: int
    date: str


class GoogleCalendarAuthUrl(BaseModel):
    auth_url: str


class GoogleCalendarToken(BaseModel):
    code: str


