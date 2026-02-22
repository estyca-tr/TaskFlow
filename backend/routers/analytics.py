from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import Optional
from datetime import datetime, timedelta
from collections import defaultdict
import json

from database import get_db
from models import Meeting, Employee, ActionItem, Topic
from schemas import (
    EmployeeAnalytics, OverallAnalytics, TopicFrequency,
    AIAnalysisRequest, AIAnalysisResponse
)
from services.ai_analyzer import AIAnalyzer

router = APIRouter()


@router.get("/overview", response_model=OverallAnalytics)
def get_overall_analytics(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get overall analytics across all employees for current user"""
    # Default to last 6 months if no dates provided
    if not end_date:
        end_date = datetime.utcnow()
    if not start_date:
        start_date = end_date - timedelta(days=180)
    
    # Total counts - filtered by user_id
    employee_query = db.query(func.count(Employee.id)).filter(Employee.is_active == True)
    if user_id:
        employee_query = employee_query.filter(Employee.user_id == user_id)
    total_employees = employee_query.scalar()
    
    # Total meetings - filtered by user_id through employee
    meeting_query = db.query(func.count(Meeting.id)).join(Employee).filter(
        Meeting.date >= start_date,
        Meeting.date <= end_date
    )
    if user_id:
        meeting_query = meeting_query.filter(Employee.user_id == user_id)
    total_meetings = meeting_query.scalar()
    
    # Top topics - filtered by user_id
    topics_query = db.query(
        Topic.name,
        Topic.category,
        func.count(Topic.id).label('count')
    ).join(Meeting).join(Employee).filter(
        Meeting.date >= start_date,
        Meeting.date <= end_date
    )
    if user_id:
        topics_query = topics_query.filter(Employee.user_id == user_id)
    topics = topics_query.group_by(Topic.name, Topic.category).order_by(func.count(Topic.id).desc()).limit(10).all()
    
    top_topics = [TopicFrequency(topic=t[0], category=t[1], count=t[2]) for t in topics]
    
    # Sentiment distribution - filtered by user_id
    sentiment_query = db.query(
        Meeting.ai_sentiment,
        func.count(Meeting.id)
    ).join(Employee).filter(
        Meeting.date >= start_date,
        Meeting.date <= end_date,
        Meeting.ai_sentiment.isnot(None)
    )
    if user_id:
        sentiment_query = sentiment_query.filter(Employee.user_id == user_id)
    sentiments = sentiment_query.group_by(Meeting.ai_sentiment).all()
    
    sentiment_distribution = {s[0]: s[1] for s in sentiments}
    
    # Meetings per month - filtered by user_id
    meetings_month_query = db.query(
        extract('year', Meeting.date).label('year'),
        extract('month', Meeting.date).label('month'),
        func.count(Meeting.id)
    ).join(Employee).filter(
        Meeting.date >= start_date,
        Meeting.date <= end_date
    )
    if user_id:
        meetings_month_query = meetings_month_query.filter(Employee.user_id == user_id)
    meetings_by_month = meetings_month_query.group_by('year', 'month').order_by('year', 'month').all()
    
    meetings_per_month = {
        f"{int(m[0])}-{int(m[1]):02d}": m[2] for m in meetings_by_month
    }
    
    return OverallAnalytics(
        total_employees=total_employees,
        total_meetings=total_meetings,
        top_topics=top_topics,
        sentiment_distribution=sentiment_distribution,
        meetings_per_month=meetings_per_month
    )


@router.get("/employee/{employee_id}", response_model=EmployeeAnalytics)
def get_employee_analytics(
    employee_id: int,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    """Get analytics for a specific employee"""
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Default to last 12 months if no dates provided
    if not end_date:
        end_date = datetime.utcnow()
    if not start_date:
        start_date = end_date - timedelta(days=365)
    
    # Total meetings
    total_meetings = db.query(func.count(Meeting.id)).filter(
        Meeting.employee_id == employee_id,
        Meeting.date >= start_date,
        Meeting.date <= end_date
    ).scalar()
    
    # Top topics for this employee
    topics = db.query(
        Topic.name,
        Topic.category,
        func.count(Topic.id).label('count')
    ).join(Meeting).filter(
        Meeting.employee_id == employee_id,
        Meeting.date >= start_date,
        Meeting.date <= end_date
    ).group_by(Topic.name, Topic.category).order_by(func.count(Topic.id).desc()).limit(10).all()
    
    top_topics = [TopicFrequency(topic=t[0], category=t[1], count=t[2]) for t in topics]
    
    # Action items status
    pending_items = db.query(func.count(ActionItem.id)).join(Meeting).filter(
        Meeting.employee_id == employee_id,
        ActionItem.status.in_(["pending", "in_progress"])
    ).scalar()
    
    completed_items = db.query(func.count(ActionItem.id)).join(Meeting).filter(
        Meeting.employee_id == employee_id,
        ActionItem.status == "completed"
    ).scalar()
    
    return EmployeeAnalytics(
        employee_id=employee_id,
        employee_name=employee.name,
        total_meetings=total_meetings,
        top_topics=top_topics,
        pending_action_items=pending_items,
        completed_action_items=completed_items
    )


@router.get("/action-items/pending")
def get_pending_action_items(
    employee_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get all pending action items"""
    query = db.query(ActionItem).join(Meeting).join(Employee).filter(
        ActionItem.status.in_(["pending", "in_progress"])
    )
    
    if employee_id:
        query = query.filter(Meeting.employee_id == employee_id)
    
    items = query.order_by(ActionItem.due_date).all()
    
    result = []
    for item in items:
        result.append({
            "id": item.id,
            "description": item.description,
            "assignee": item.assignee,
            "due_date": item.due_date,
            "status": item.status,
            "employee_id": item.meeting.employee_id,
            "employee_name": item.meeting.employee.name,
            "meeting_date": item.meeting.date
        })
    
    return result


@router.post("/analyze", response_model=AIAnalysisResponse)
async def analyze_meeting(request: AIAnalysisRequest, db: Session = Depends(get_db)):
    """Analyze meeting notes using AI"""
    meeting = db.query(Meeting).filter(Meeting.id == request.meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    analyzer = AIAnalyzer()
    analysis = await analyzer.analyze_notes(request.notes)
    
    # Update meeting with AI analysis
    meeting.ai_insights = analysis.insights
    meeting.ai_topics = json.dumps(analysis.topics)
    meeting.ai_sentiment = analysis.sentiment
    
    db.commit()
    
    return analysis


@router.get("/topics/trends")
def get_topic_trends(
    months: int = Query(6, ge=1, le=24),
    db: Session = Depends(get_db)
):
    """Get topic trends over time"""
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=months * 30)
    
    topics_by_month = db.query(
        extract('year', Meeting.date).label('year'),
        extract('month', Meeting.date).label('month'),
        Topic.name,
        Topic.category,
        func.count(Topic.id).label('count')
    ).join(Meeting).filter(
        Meeting.date >= start_date,
        Meeting.date <= end_date
    ).group_by('year', 'month', Topic.name, Topic.category).all()
    
    # Organize by month
    trends = defaultdict(lambda: defaultdict(int))
    for t in topics_by_month:
        month_key = f"{int(t[0])}-{int(t[1]):02d}"
        topic_key = t[2]
        trends[month_key][topic_key] = t[4]
    
    return dict(trends)


