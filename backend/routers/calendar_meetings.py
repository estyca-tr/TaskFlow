"""
Calendar Meetings API - לניהול ישיבות יומיות והכנה אליהן
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime, date, timedelta
from typing import Optional, List
from pydantic import BaseModel
import json
import os
import httpx
import base64
import re

from database import get_db
from models import CalendarMeeting, MeetingPrepNote
from schemas import (
    CalendarMeetingCreate, CalendarMeetingUpdate, CalendarMeetingResponse,
    CalendarMeetingsListResponse, MeetingPrepNoteCreate, MeetingPrepNoteUpdate,
    MeetingPrepNoteResponse
)


class ScreenshotExtractRequest(BaseModel):
    image: str  # Base64 encoded image
    target_date: str  # YYYY-MM-DD


class ExtractedMeeting(BaseModel):
    title: str
    start_time: str  # HH:MM
    end_time: str  # HH:MM
    location: Optional[str] = None
    attendees: Optional[str] = None


class ScreenshotExtractResponse(BaseModel):
    meetings: List[ExtractedMeeting]
    total: int

router = APIRouter()


@router.get("/", response_model=CalendarMeetingsListResponse)
async def get_calendar_meetings(
    target_date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    user_id: Optional[int] = Query(None, description="Filter by user"),
    db: Session = Depends(get_db)
):
    """קבלת ישיבות לתאריך מסוים (ברירת מחדל: היום)"""
    if target_date:
        try:
            selected_date = datetime.strptime(target_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    else:
        selected_date = date.today()
    
    # Get start and end of the selected day
    day_start = datetime.combine(selected_date, datetime.min.time())
    day_end = datetime.combine(selected_date, datetime.max.time())
    
    query = db.query(CalendarMeeting).filter(
        and_(
            CalendarMeeting.start_time >= day_start,
            CalendarMeeting.start_time <= day_end
        )
    )
    
    # Filter by user if provided
    if user_id:
        query = query.filter(CalendarMeeting.user_id == user_id)
    
    meetings = query.order_by(CalendarMeeting.start_time).all()
    
    return CalendarMeetingsListResponse(
        meetings=[CalendarMeetingResponse.model_validate(m) for m in meetings],
        total=len(meetings),
        date=selected_date.isoformat()
    )


@router.get("/week", response_model=List[CalendarMeetingResponse])
async def get_week_meetings(
    start_date: Optional[str] = Query(None, description="Start date in YYYY-MM-DD format"),
    db: Session = Depends(get_db)
):
    """קבלת ישיבות לשבוע (מתאריך התחלה או מהיום)"""
    if start_date:
        try:
            week_start = datetime.strptime(start_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    else:
        week_start = date.today()
    
    week_end = week_start + timedelta(days=7)
    
    day_start = datetime.combine(week_start, datetime.min.time())
    day_end = datetime.combine(week_end, datetime.max.time())
    
    meetings = db.query(CalendarMeeting).filter(
        and_(
            CalendarMeeting.start_time >= day_start,
            CalendarMeeting.start_time <= day_end
        )
    ).order_by(CalendarMeeting.start_time).all()
    
    return [CalendarMeetingResponse.model_validate(m) for m in meetings]


@router.get("/{meeting_id}", response_model=CalendarMeetingResponse)
async def get_calendar_meeting(meeting_id: int, db: Session = Depends(get_db)):
    """קבלת פרטי ישיבה ספציפית"""
    meeting = db.query(CalendarMeeting).filter(CalendarMeeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return CalendarMeetingResponse.model_validate(meeting)


@router.post("/", response_model=CalendarMeetingResponse)
async def create_calendar_meeting(
    meeting: CalendarMeetingCreate, 
    user_id: Optional[int] = Query(None, description="User ID"),
    db: Session = Depends(get_db)
):
    """יצירת ישיבה חדשה (ידנית)"""
    db_meeting = CalendarMeeting(
        user_id=user_id,
        external_id=meeting.external_id,
        title=meeting.title,
        description=meeting.description,
        start_time=meeting.start_time,
        end_time=meeting.end_time,
        location=meeting.location,
        attendees=meeting.attendees,
        calendar_source=meeting.calendar_source,
        is_recurring=meeting.is_recurring
    )
    db.add(db_meeting)
    db.commit()
    db.refresh(db_meeting)
    return CalendarMeetingResponse.model_validate(db_meeting)


@router.put("/{meeting_id}", response_model=CalendarMeetingResponse)
async def update_calendar_meeting(
    meeting_id: int,
    meeting: CalendarMeetingUpdate,
    db: Session = Depends(get_db)
):
    """עדכון פרטי ישיבה"""
    db_meeting = db.query(CalendarMeeting).filter(CalendarMeeting.id == meeting_id).first()
    if not db_meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    update_data = meeting.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_meeting, field, value)
    
    db.commit()
    db.refresh(db_meeting)
    return CalendarMeetingResponse.model_validate(db_meeting)


@router.delete("/{meeting_id}")
async def delete_calendar_meeting(meeting_id: int, db: Session = Depends(get_db)):
    """מחיקת ישיבה"""
    db_meeting = db.query(CalendarMeeting).filter(CalendarMeeting.id == meeting_id).first()
    if not db_meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    db.delete(db_meeting)
    db.commit()
    return {"message": "Meeting deleted successfully"}


# ============== Screenshot Extraction ==============

@router.post("/extract-from-screenshot", response_model=ScreenshotExtractResponse)
async def extract_meetings_from_screenshot(request: ScreenshotExtractRequest):
    """חילוץ ישיבות מצילום מסך של קאלנדר באמצעות AI"""
    
    # Get API key from environment
    anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
    openai_api_key = os.getenv("OPENAI_API_KEY")
    
    if not anthropic_api_key and not openai_api_key:
        # Return sample data for testing if no API key
        return ScreenshotExtractResponse(
            meetings=[
                ExtractedMeeting(
                    title="ישיבת צוות",
                    start_time="09:00",
                    end_time="10:00",
                    attendees="צוות פיתוח"
                ),
                ExtractedMeeting(
                    title="1:1 עם מנהל",
                    start_time="11:00",
                    end_time="11:30"
                )
            ],
            total=2
        )
    
    # Extract base64 data from data URL if present
    image_data = request.image
    if image_data.startswith('data:'):
        # Extract the base64 part after the comma
        image_data = image_data.split(',')[1]
    
    try:
        if anthropic_api_key:
            meetings = await extract_with_claude(image_data, anthropic_api_key, request.target_date)
        else:
            meetings = await extract_with_openai(image_data, openai_api_key, request.target_date)
        
        return ScreenshotExtractResponse(
            meetings=meetings,
            total=len(meetings)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error extracting meetings: {str(e)}")


async def extract_with_claude(image_base64: str, api_key: str, target_date: str) -> List[ExtractedMeeting]:
    """Extract meetings using Claude Vision API"""
    
    prompt = f"""אנא נתח את צילום המסך הזה של יומן/קאלנדר וחלץ את כל הישיבות/פגישות שאתה רואה.

לכל ישיבה, ספק את הפרטים הבאים בפורמט JSON:
- title: שם/כותרת הישיבה
- start_time: שעת התחלה בפורמט HH:MM (24 שעות)
- end_time: שעת סיום בפורמט HH:MM (24 שעות)
- location: מיקום (אם מופיע)
- attendees: משתתפים (אם מופיעים)

התאריך הנדרש: {target_date}

החזר תשובה בפורמט JSON בלבד:
{{"meetings": [
  {{"title": "...", "start_time": "HH:MM", "end_time": "HH:MM", "location": "...", "attendees": "..."}},
  ...
]}}

אם אין ישיבות בתמונה, החזר: {{"meetings": []}}
"""

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            },
            json={
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 2000,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/png",
                                    "data": image_base64
                                }
                            },
                            {
                                "type": "text",
                                "text": prompt
                            }
                        ]
                    }
                ]
            },
            timeout=60.0
        )
        
        if response.status_code != 200:
            raise Exception(f"Claude API error: {response.text}")
        
        result = response.json()
        content = result["content"][0]["text"]
        
        # Parse JSON from response
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            data = json.loads(json_match.group())
            return [ExtractedMeeting(**m) for m in data.get("meetings", [])]
        
        return []


async def extract_with_openai(image_base64: str, api_key: str, target_date: str) -> List[ExtractedMeeting]:
    """Extract meetings using OpenAI Vision API"""
    
    prompt = f"""Analyze this calendar screenshot and extract all meetings/events.

For each meeting, provide these details in JSON format:
- title: meeting name
- start_time: start time in HH:MM (24-hour format)
- end_time: end time in HH:MM (24-hour format)  
- location: location (if shown)
- attendees: attendees (if shown)

Target date: {target_date}

Return JSON only:
{{"meetings": [
  {{"title": "...", "start_time": "HH:MM", "end_time": "HH:MM", "location": "...", "attendees": "..."}},
  ...
]}}

If no meetings in image, return: {{"meetings": []}}
"""

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": "gpt-4o",
                "max_tokens": 2000,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/png;base64,{image_base64}"
                                }
                            },
                            {
                                "type": "text",
                                "text": prompt
                            }
                        ]
                    }
                ]
            },
            timeout=60.0
        )
        
        if response.status_code != 200:
            raise Exception(f"OpenAI API error: {response.text}")
        
        result = response.json()
        content = result["choices"][0]["message"]["content"]
        
        # Parse JSON from response
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            data = json.loads(json_match.group())
            return [ExtractedMeeting(**m) for m in data.get("meetings", [])]
        
        return []


# ============== Prep Notes Endpoints ==============

@router.post("/{meeting_id}/notes", response_model=MeetingPrepNoteResponse)
async def add_prep_note(
    meeting_id: int,
    note: MeetingPrepNoteCreate,
    db: Session = Depends(get_db)
):
    """הוספת נקודה להכנה לישיבה"""
    meeting = db.query(CalendarMeeting).filter(CalendarMeeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Get max order index
    max_order = db.query(MeetingPrepNote).filter(
        MeetingPrepNote.calendar_meeting_id == meeting_id
    ).count()
    
    db_note = MeetingPrepNote(
        calendar_meeting_id=meeting_id,
        content=note.content,
        is_completed=note.is_completed,
        order_index=max_order
    )
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    return MeetingPrepNoteResponse.model_validate(db_note)


@router.put("/{meeting_id}/notes/{note_id}", response_model=MeetingPrepNoteResponse)
async def update_prep_note(
    meeting_id: int,
    note_id: int,
    note: MeetingPrepNoteUpdate,
    db: Session = Depends(get_db)
):
    """עדכון נקודת הכנה"""
    db_note = db.query(MeetingPrepNote).filter(
        and_(
            MeetingPrepNote.id == note_id,
            MeetingPrepNote.calendar_meeting_id == meeting_id
        )
    ).first()
    
    if not db_note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    update_data = note.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_note, field, value)
    
    db.commit()
    db.refresh(db_note)
    return MeetingPrepNoteResponse.model_validate(db_note)


@router.delete("/{meeting_id}/notes/{note_id}")
async def delete_prep_note(meeting_id: int, note_id: int, db: Session = Depends(get_db)):
    """מחיקת נקודת הכנה"""
    db_note = db.query(MeetingPrepNote).filter(
        and_(
            MeetingPrepNote.id == note_id,
            MeetingPrepNote.calendar_meeting_id == meeting_id
        )
    ).first()
    
    if not db_note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    db.delete(db_note)
    db.commit()
    return {"message": "Note deleted successfully"}


@router.post("/{meeting_id}/notes/{note_id}/toggle", response_model=MeetingPrepNoteResponse)
async def toggle_prep_note(meeting_id: int, note_id: int, db: Session = Depends(get_db)):
    """החלפת סטטוס הושלם/לא הושלם של נקודה"""
    db_note = db.query(MeetingPrepNote).filter(
        and_(
            MeetingPrepNote.id == note_id,
            MeetingPrepNote.calendar_meeting_id == meeting_id
        )
    ).first()
    
    if not db_note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    db_note.is_completed = not db_note.is_completed
    db.commit()
    db.refresh(db_note)
    return MeetingPrepNoteResponse.model_validate(db_note)




