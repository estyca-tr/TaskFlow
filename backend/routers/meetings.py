from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc
from typing import List, Optional
from datetime import datetime

from database import get_db
from models import Meeting, Employee, ActionItem, Topic
from schemas import (
    MeetingCreate, MeetingUpdate, MeetingResponse,
    ActionItemCreate, ActionItemUpdate, ActionItemResponse,
    TopicCreate, TopicResponse,
    ExtractTasksResponse
)
from services.ai_analyzer import AIAnalyzer

router = APIRouter()


@router.get("/", response_model=List[MeetingResponse])
def get_meetings(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    employee_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    """Get all meetings with optional filtering"""
    query = db.query(Meeting).options(
        joinedload(Meeting.action_items),
        joinedload(Meeting.topics),
        joinedload(Meeting.employee)
    )
    
    if employee_id:
        query = query.filter(Meeting.employee_id == employee_id)
    
    if start_date:
        query = query.filter(Meeting.date >= start_date)
    
    if end_date:
        query = query.filter(Meeting.date <= end_date)
    
    meetings = query.order_by(desc(Meeting.date)).offset(skip).limit(limit).all()
    
    result = []
    for meeting in meetings:
        meeting_dict = {
            "id": meeting.id,
            "employee_id": meeting.employee_id,
            "date": meeting.date,
            "duration_minutes": meeting.duration_minutes,
            "notes": meeting.notes,
            "summary": meeting.summary,
            "ai_insights": meeting.ai_insights,
            "ai_topics": meeting.ai_topics,
            "ai_sentiment": meeting.ai_sentiment,
            "created_at": meeting.created_at,
            "updated_at": meeting.updated_at,
            "action_items": meeting.action_items,
            "topics": meeting.topics,
            "employee_name": meeting.employee.name if meeting.employee else None
        }
        result.append(MeetingResponse(**meeting_dict))
    
    return result


@router.get("/{meeting_id}", response_model=MeetingResponse)
def get_meeting(meeting_id: int, db: Session = Depends(get_db)):
    """Get a specific meeting by ID"""
    meeting = db.query(Meeting).options(
        joinedload(Meeting.action_items),
        joinedload(Meeting.topics),
        joinedload(Meeting.employee)
    ).filter(Meeting.id == meeting_id).first()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    return MeetingResponse(
        id=meeting.id,
        employee_id=meeting.employee_id,
        date=meeting.date,
        duration_minutes=meeting.duration_minutes,
        notes=meeting.notes,
        summary=meeting.summary,
        ai_insights=meeting.ai_insights,
        ai_topics=meeting.ai_topics,
        ai_sentiment=meeting.ai_sentiment,
        created_at=meeting.created_at,
        updated_at=meeting.updated_at,
        action_items=meeting.action_items,
        topics=meeting.topics,
        employee_name=meeting.employee.name if meeting.employee else None
    )


@router.post("/", response_model=MeetingResponse, status_code=201)
def create_meeting(meeting: MeetingCreate, db: Session = Depends(get_db)):
    """Create a new meeting"""
    # Verify employee exists
    employee = db.query(Employee).filter(Employee.id == meeting.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Create meeting
    meeting_data = meeting.model_dump(exclude={"action_items", "topics"})
    db_meeting = Meeting(**meeting_data)
    db.add(db_meeting)
    db.flush()  # Get the meeting ID
    
    # Add action items
    for item in meeting.action_items or []:
        db_item = ActionItem(meeting_id=db_meeting.id, **item.model_dump())
        db.add(db_item)
    
    # Add topics
    for topic in meeting.topics or []:
        db_topic = Topic(meeting_id=db_meeting.id, **topic.model_dump())
        db.add(db_topic)
    
    db.commit()
    db.refresh(db_meeting)
    
    return MeetingResponse(
        id=db_meeting.id,
        employee_id=db_meeting.employee_id,
        date=db_meeting.date,
        duration_minutes=db_meeting.duration_minutes,
        notes=db_meeting.notes,
        summary=db_meeting.summary,
        ai_insights=db_meeting.ai_insights,
        ai_topics=db_meeting.ai_topics,
        ai_sentiment=db_meeting.ai_sentiment,
        created_at=db_meeting.created_at,
        updated_at=db_meeting.updated_at,
        action_items=db_meeting.action_items,
        topics=db_meeting.topics,
        employee_name=employee.name
    )


@router.put("/{meeting_id}", response_model=MeetingResponse)
def update_meeting(meeting_id: int, meeting: MeetingUpdate, db: Session = Depends(get_db)):
    """Update an existing meeting"""
    db_meeting = db.query(Meeting).options(
        joinedload(Meeting.action_items),
        joinedload(Meeting.topics),
        joinedload(Meeting.employee)
    ).filter(Meeting.id == meeting_id).first()
    
    if not db_meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    update_data = meeting.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_meeting, key, value)
    
    db.commit()
    db.refresh(db_meeting)
    
    return MeetingResponse(
        id=db_meeting.id,
        employee_id=db_meeting.employee_id,
        date=db_meeting.date,
        duration_minutes=db_meeting.duration_minutes,
        notes=db_meeting.notes,
        summary=db_meeting.summary,
        ai_insights=db_meeting.ai_insights,
        ai_topics=db_meeting.ai_topics,
        ai_sentiment=db_meeting.ai_sentiment,
        created_at=db_meeting.created_at,
        updated_at=db_meeting.updated_at,
        action_items=db_meeting.action_items,
        topics=db_meeting.topics,
        employee_name=db_meeting.employee.name if db_meeting.employee else None
    )


@router.delete("/{meeting_id}", status_code=204)
def delete_meeting(meeting_id: int, db: Session = Depends(get_db)):
    """Delete a meeting"""
    db_meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not db_meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    db.delete(db_meeting)
    db.commit()
    return None


# ============== Action Items ==============

@router.post("/{meeting_id}/action-items", response_model=ActionItemResponse, status_code=201)
def add_action_item(meeting_id: int, item: ActionItemCreate, db: Session = Depends(get_db)):
    """Add an action item to a meeting"""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    db_item = ActionItem(meeting_id=meeting_id, **item.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    
    return ActionItemResponse.model_validate(db_item)


@router.put("/action-items/{item_id}", response_model=ActionItemResponse)
def update_action_item(item_id: int, item: ActionItemUpdate, db: Session = Depends(get_db)):
    """Update an action item"""
    db_item = db.query(ActionItem).filter(ActionItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Action item not found")
    
    update_data = item.model_dump(exclude_unset=True)
    
    # Track completion
    if "status" in update_data and update_data["status"] == "completed":
        update_data["completed_at"] = datetime.utcnow()
    
    for key, value in update_data.items():
        setattr(db_item, key, value)
    
    db.commit()
    db.refresh(db_item)
    
    return ActionItemResponse.model_validate(db_item)


@router.delete("/action-items/{item_id}", status_code=204)
def delete_action_item(item_id: int, db: Session = Depends(get_db)):
    """Delete an action item"""
    db_item = db.query(ActionItem).filter(ActionItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Action item not found")
    
    db.delete(db_item)
    db.commit()
    return None


# ============== Topics ==============

@router.post("/{meeting_id}/topics", response_model=TopicResponse, status_code=201)
def add_topic(meeting_id: int, topic: TopicCreate, db: Session = Depends(get_db)):
    """Add a topic to a meeting"""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    db_topic = Topic(meeting_id=meeting_id, **topic.model_dump())
    db.add(db_topic)
    db.commit()
    db.refresh(db_topic)
    
    return TopicResponse.model_validate(db_topic)


@router.delete("/topics/{topic_id}", status_code=204)
def delete_topic(topic_id: int, db: Session = Depends(get_db)):
    """Delete a topic"""
    db_topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not db_topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    db.delete(db_topic)
    db.commit()
    return None


# ============== Task Extraction ==============

@router.post("/{meeting_id}/extract-tasks", response_model=ExtractTasksResponse)
async def extract_tasks_from_meeting(meeting_id: int, db: Session = Depends(get_db)):
    """Extract tasks from meeting notes using AI"""
    meeting = db.query(Meeting).options(
        joinedload(Meeting.employee)
    ).filter(Meeting.id == meeting_id).first()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    if not meeting.notes:
        return ExtractTasksResponse(suggested_tasks=[])
    
    analyzer = AIAnalyzer()
    result = await analyzer.extract_tasks_from_notes(
        notes=meeting.notes,
        person_id=meeting.employee_id,
        meeting_id=meeting_id
    )
    
    return result


