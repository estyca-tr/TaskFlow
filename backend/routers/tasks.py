from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
import os
import httpx
import json
import re

from database import get_db
from models import Task, Employee, Meeting, User
from schemas import (
    TaskCreate, TaskUpdate, TaskResponse, 
    TasksListResponse, ExtractTasksRequest, ExtractTasksResponse
)

router = APIRouter()


# ============== Screenshot Task Extraction Models ==============

class ExtractedTask(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "medium"  # low, medium, high
    person_name: Optional[str] = None  # Related person if detected
    due_date: Optional[str] = None  # YYYY-MM-DD if detected


class ScreenshotTaskExtractRequest(BaseModel):
    image: str  # Base64 encoded image
    context: Optional[str] = None  # Additional context about the meeting


class ScreenshotTaskExtractResponse(BaseModel):
    tasks: List[ExtractedTask]
    total: int
    meeting_title: Optional[str] = None
    summary: Optional[str] = None


def build_task_response(task: Task, db: Session, include_creator: bool = False, is_assigned_to_me: bool = False) -> TaskResponse:
    """Build a TaskResponse with person name and optionally creator info"""
    person_name = None
    if task.person_id:
        person = db.query(Employee).filter(Employee.id == task.person_id).first()
        if person:
            person_name = person.name
    
    # Get creator info if requested
    assigned_by = None
    assigned_by_id = None
    if include_creator and task.user_id:
        creator = db.query(User).filter(User.id == task.user_id).first()
        if creator:
            assigned_by = creator.display_name or creator.username
            assigned_by_id = creator.id
    
    return TaskResponse(
        id=task.id,
        title=task.title,
        description=task.description,
        task_type=task.task_type,
        priority=task.priority,
        status=task.status,
        person_id=task.person_id,
        meeting_id=task.meeting_id,
        person_name=person_name,
        assigned_by=assigned_by,
        assigned_by_id=assigned_by_id,
        is_assigned_to_me=is_assigned_to_me,
        due_date=task.due_date,
        completed_at=task.completed_at,
        created_at=task.created_at,
        updated_at=task.updated_at
    )


@router.get("/", response_model=TasksListResponse)
def get_tasks(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    task_type: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    person_id: Optional[int] = None,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get all tasks with optional filtering"""
    query = db.query(Task)
    
    # Filter by user if provided
    if user_id:
        query = query.filter(Task.user_id == user_id)
    
    if task_type:
        query = query.filter(Task.task_type == task_type)
    
    if status:
        query = query.filter(Task.status == status)
    
    if priority:
        query = query.filter(Task.priority == priority)
    
    if person_id:
        query = query.filter(Task.person_id == person_id)
    
    # Get counts
    total = query.count()
    pending = query.filter(Task.status == "pending").count()
    in_progress = query.filter(Task.status == "in_progress").count()
    completed = query.filter(Task.status == "completed").count()
    
    # Reset filters for fetching
    query = db.query(Task)
    if user_id:
        query = query.filter(Task.user_id == user_id)
    if task_type:
        query = query.filter(Task.task_type == task_type)
    if status:
        query = query.filter(Task.status == status)
    if priority:
        query = query.filter(Task.priority == priority)
    if person_id:
        query = query.filter(Task.person_id == person_id)
    
    tasks = query.order_by(Task.created_at.desc()).offset(skip).limit(limit).all()
    
    task_responses = [build_task_response(task, db) for task in tasks]
    
    return TasksListResponse(
        tasks=task_responses,
        total=total,
        pending=pending,
        in_progress=in_progress,
        completed=completed
    )


@router.get("/my", response_model=List[TaskResponse])
def get_my_tasks(
    status: Optional[str] = None,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get personal tasks only (not related to a person)"""
    query = db.query(Task).filter(Task.task_type == "personal")
    
    if user_id:
        query = query.filter(Task.user_id == user_id)
    
    if status:
        query = query.filter(Task.status == status)
    
    tasks = query.order_by(Task.due_date.asc().nullslast(), Task.created_at.desc()).all()
    
    return [build_task_response(task, db) for task in tasks]


@router.get("/assigned-to-me", response_model=List[TaskResponse])
def get_tasks_assigned_to_me(
    user_id: int = Query(..., description="Current user ID"),
    include_completed: bool = False,
    db: Session = Depends(get_db)
):
    """
    Get tasks that are assigned to the current user by name matching.
    These are tasks created by OTHER users where the person_id refers to 
    an Employee whose name matches the current user's username.
    Also auto-creates a person entry for the task creator if not exists.
    """
    # Get current user
    current_user = db.query(User).filter(User.id == user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    username = current_user.username.strip().lower()
    display_name = (current_user.display_name or "").strip().lower()
    
    # Find all Employees (people) whose name matches the current user
    matching_persons = db.query(Employee).filter(
        func.lower(func.trim(Employee.name)).in_([username, display_name])
    ).all()
    
    if not matching_persons:
        return []
    
    person_ids = [p.id for p in matching_persons]
    
    # Find tasks that:
    # 1. Are associated with one of these persons (person_id matches)
    # 2. Were created by ANOTHER user (not the current user)
    query = db.query(Task).filter(
        Task.person_id.in_(person_ids),
        Task.user_id != user_id  # Created by someone else
    )
    
    if not include_completed:
        query = query.filter(Task.status != "completed")
    
    tasks = query.order_by(Task.priority.desc(), Task.created_at.desc()).all()
    
    # Auto-create person entries for task creators in current user's people list
    for task in tasks:
        if task.user_id:
            creator = db.query(User).filter(User.id == task.user_id).first()
            if creator:
                creator_name = creator.display_name or creator.username
                # Check if this person already exists in current user's people list
                existing_person = db.query(Employee).filter(
                    Employee.user_id == user_id,
                    func.lower(func.trim(Employee.name)) == creator_name.strip().lower()
                ).first()
                
                if not existing_person:
                    # Create a new person entry for the creator
                    new_person = Employee(
                        user_id=user_id,
                        name=creator_name,
                        person_type="colleague",  # Default to colleague
                        notes=f"נוסף אוטומטית - יצר/ה משימות עבורך"
                    )
                    db.add(new_person)
    
    db.commit()
    
    return [build_task_response(task, db, include_creator=True) for task in tasks]


@router.get("/assigned-to-me/count")
def get_assigned_tasks_count(
    user_id: int = Query(..., description="Current user ID"),
    db: Session = Depends(get_db)
):
    """Get count of tasks assigned to the current user (not completed)"""
    current_user = db.query(User).filter(User.id == user_id).first()
    if not current_user:
        return {"count": 0}
    
    username = current_user.username.strip().lower()
    display_name = (current_user.display_name or "").strip().lower()
    
    matching_persons = db.query(Employee).filter(
        func.lower(func.trim(Employee.name)).in_([username, display_name])
    ).all()
    
    if not matching_persons:
        return {"count": 0}
    
    person_ids = [p.id for p in matching_persons]
    
    count = db.query(Task).filter(
        Task.person_id.in_(person_ids),
        Task.user_id != user_id,
        Task.status != "completed"
    ).count()
    
    return {"count": count}


@router.get("/discuss/{person_id}", response_model=List[TaskResponse])
def get_discussion_topics(
    person_id: int,
    include_completed: bool = False,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Get discussion topics for a specific person.
    Also includes tasks that this person (by name) assigned to the current user.
    """
    # Verify person exists
    person = db.query(Employee).filter(Employee.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    
    # Query 1: Tasks I created about this person (only if user_id is provided)
    my_tasks = []
    if user_id:
        query1 = db.query(Task).filter(
            Task.task_type == "discuss_with",
            Task.person_id == person_id,
            Task.user_id == user_id  # Only tasks created by current user
        )
        
        if not include_completed:
            query1 = query1.filter(Task.status != "completed")
        
        my_tasks = query1.all()
    else:
        # Fallback for backward compatibility
        query1 = db.query(Task).filter(
            Task.task_type == "discuss_with",
            Task.person_id == person_id
        )
        
        if not include_completed:
            query1 = query1.filter(Task.status != "completed")
        
        my_tasks = query1.all()
    
    # Query 2: Tasks this person (by name) assigned to me
    assigned_tasks = []
    if user_id:
        # Find user whose name matches this person's name
        person_name_lower = person.name.strip().lower()
        matching_user = db.query(User).filter(
            or_(
                func.lower(func.trim(User.username)) == person_name_lower,
                func.lower(func.trim(User.display_name)) == person_name_lower
            )
        ).first()
        
        if matching_user:
            # Find tasks created by this user that are assigned to me (current user)
            # Look for tasks where the person_id refers to someone with my username
            current_user = db.query(User).filter(User.id == user_id).first()
            if current_user:
                my_name_lower = current_user.username.strip().lower()
                my_display_lower = (current_user.display_name or "").strip().lower()
                
                # Find employee IDs that match my name (across all users' people lists)
                my_person_ids = db.query(Employee.id).filter(
                    func.lower(func.trim(Employee.name)).in_([my_name_lower, my_display_lower])
                ).all()
                my_person_ids = [p[0] for p in my_person_ids]
                
                if my_person_ids:
                    query2 = db.query(Task).filter(
                        Task.user_id == matching_user.id,
                        Task.person_id.in_(my_person_ids)
                    )
                    
                    if not include_completed:
                        query2 = query2.filter(Task.status != "completed")
                    
                    assigned_tasks = query2.all()
    
    # Build responses with proper is_assigned_to_me flag
    assigned_task_ids = {task.id for task in assigned_tasks}
    
    all_task_ids = set()
    result = []
    
    # Add my tasks (not assigned to me)
    for task in my_tasks:
        if task.id not in all_task_ids:
            all_task_ids.add(task.id)
            result.append(build_task_response(task, db, include_creator=True, is_assigned_to_me=False))
    
    # Add assigned tasks (assigned to me)
    for task in assigned_tasks:
        if task.id not in all_task_ids:
            all_task_ids.add(task.id)
            result.append(build_task_response(task, db, include_creator=True, is_assigned_to_me=True))
    
    # Sort by priority and creation date
    result.sort(key=lambda t: (-['low', 'medium', 'high'].index(t.priority or 'medium'), t.created_at), reverse=True)
    
    return result


@router.get("/today", response_model=List[TaskResponse])
def get_today_tasks(
    user_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get tasks due today or overdue for current user"""
    today = datetime.now().replace(hour=23, minute=59, second=59)
    
    query = db.query(Task).filter(
        Task.status.in_(["pending", "in_progress"]),
        Task.due_date <= today
    )
    
    if user_id:
        query = query.filter(Task.user_id == user_id)
    
    tasks = query.order_by(Task.due_date.asc()).all()
    
    return [build_task_response(task, db) for task in tasks]


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    """Get a specific task by ID"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return build_task_response(task, db)


@router.post("/", response_model=TaskResponse, status_code=201)
def create_task(task: TaskCreate, user_id: Optional[int] = None, db: Session = Depends(get_db)):
    """Create a new task"""
    # Validate person_id if provided
    if task.person_id:
        person = db.query(Employee).filter(Employee.id == task.person_id).first()
        if not person:
            raise HTTPException(status_code=404, detail="Person not found")
    
    # Validate meeting_id if provided
    if task.meeting_id:
        meeting = db.query(Meeting).filter(Meeting.id == task.meeting_id).first()
        if not meeting:
            raise HTTPException(status_code=404, detail="Meeting not found")
    
    task_data = task.model_dump()
    if user_id:
        task_data["user_id"] = user_id
    db_task = Task(**task_data)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    
    return build_task_response(db_task, db)


@router.put("/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, task: TaskUpdate, db: Session = Depends(get_db)):
    """Update an existing task"""
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    update_data = task.model_dump(exclude_unset=True)
    
    # If marking as completed, set completed_at
    if update_data.get("status") == "completed" and db_task.status != "completed":
        update_data["completed_at"] = datetime.now()
    
    for key, value in update_data.items():
        setattr(db_task, key, value)
    
    db.commit()
    db.refresh(db_task)
    
    return build_task_response(db_task, db)


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    """Delete a task"""
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    db.delete(db_task)
    db.commit()
    return None


@router.post("/{task_id}/complete", response_model=TaskResponse)
def complete_task(task_id: int, db: Session = Depends(get_db)):
    """Mark a task as completed"""
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    db_task.status = "completed"
    db_task.completed_at = datetime.now()
    
    db.commit()
    db.refresh(db_task)
    
    return build_task_response(db_task, db)


@router.post("/bulk", response_model=List[TaskResponse], status_code=201)
def create_bulk_tasks(tasks: List[TaskCreate], db: Session = Depends(get_db)):
    """Create multiple tasks at once (e.g., from meeting extraction)"""
    created_tasks = []
    
    for task in tasks:
        db_task = Task(**task.model_dump())
        db.add(db_task)
        created_tasks.append(db_task)
    
    db.commit()
    
    for task in created_tasks:
        db.refresh(task)
    
    return [build_task_response(task, db) for task in created_tasks]


# ============== Screenshot Task Extraction ==============

@router.post("/extract-from-screenshot", response_model=ScreenshotTaskExtractResponse)
async def extract_tasks_from_screenshot(request: ScreenshotTaskExtractRequest):
    """חילוץ משימות מצילום מסך של ישיבה/קאלנדר באמצעות AI Vision"""
    
    # Get API keys from environment
    azure_openai_key = os.getenv("AZURE_OPENAI_API_KEY")
    azure_openai_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    azure_openai_deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o")
    anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
    openai_api_key = os.getenv("OPENAI_API_KEY")
    
    if not azure_openai_key and not anthropic_api_key and not openai_api_key:
        # Return sample data for testing
        return ScreenshotTaskExtractResponse(
            tasks=[
                ExtractedTask(
                    title="לעקוב אחרי נושא X",
                    description="נקודה שעלתה בישיבה",
                    priority="medium"
                ),
                ExtractedTask(
                    title="לתאם פגישת המשך",
                    priority="high"
                )
            ],
            total=2,
            meeting_title="ישיבת דוגמה",
            summary="זוהי תשובת דוגמה - אנא הגדירו AZURE_OPENAI_API_KEY לחילוץ אמיתי"
        )
    
    # Extract base64 data from data URL if present
    image_data = request.image
    if image_data.startswith('data:'):
        image_data = image_data.split(',')[1]
    
    try:
        if azure_openai_key and azure_openai_endpoint:
            result = await extract_tasks_azure_openai(
                image_data, azure_openai_key, azure_openai_endpoint, 
                azure_openai_deployment, request.context
            )
        elif anthropic_api_key:
            result = await extract_tasks_claude(image_data, anthropic_api_key, request.context)
        else:
            result = await extract_tasks_openai(image_data, openai_api_key, request.context)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error extracting tasks: {str(e)}")


async def extract_tasks_azure_openai(
    image_base64: str, 
    api_key: str, 
    endpoint: str, 
    deployment: str,
    context: Optional[str] = None
) -> ScreenshotTaskExtractResponse:
    """Extract tasks from screenshot using Azure OpenAI Vision"""
    
    context_text = f"\nהקשר נוסף: {context}" if context else ""
    
    prompt = f"""אנא נתח את צילום המסך הזה וחלץ את כל המשימות, פעולות נדרשות, או נקודות מעקב שאתה רואה.

זה יכול להיות:
- צילום מסך של יומן/קאלנדר עם ישיבות
- צילום של הערות ישיבה
- צילום של רשימת משימות
- כל תמונה אחרת עם מידע על משימות
{context_text}

לכל משימה, ספק את הפרטים הבאים בפורמט JSON:
- title: תיאור קצר של המשימה (בעברית אם אפשר)
- description: פרטים נוספים (אופציונלי)
- priority: "low" / "medium" / "high" (הערך לפי החשיבות שנראית)
- person_name: שם האדם הקשור (אם מופיע)
- due_date: תאריך יעד בפורמט YYYY-MM-DD (אם מופיע)

החזר תשובה בפורמט JSON בלבד:
{{
  "meeting_title": "שם הישיבה/הקשר (אם נראה)",
  "summary": "סיכום קצר של מה שראית",
  "tasks": [
    {{"title": "...", "description": "...", "priority": "medium", "person_name": "...", "due_date": "YYYY-MM-DD"}},
    ...
  ]
}}

אם אין משימות בתמונה, החזר: {{"tasks": [], "summary": "לא נמצאו משימות בתמונה"}}
"""

    api_url = f"{endpoint}/openai/deployments/{deployment}/chat/completions?api-version=2024-02-15-preview"
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            api_url,
            headers={
                "api-key": api_key,
                "Content-Type": "application/json"
            },
            json={
                "max_tokens": 3000,
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
            timeout=90.0
        )
        
        if response.status_code != 200:
            raise Exception(f"Azure OpenAI API error: {response.text}")
        
        result = response.json()
        content = result["choices"][0]["message"]["content"]
        
        # Parse JSON from response
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            data = json.loads(json_match.group())
            tasks = [ExtractedTask(**t) for t in data.get("tasks", [])]
            return ScreenshotTaskExtractResponse(
                tasks=tasks,
                total=len(tasks),
                meeting_title=data.get("meeting_title"),
                summary=data.get("summary")
            )
        
        return ScreenshotTaskExtractResponse(tasks=[], total=0, summary="לא הצלחתי לפרסר את התשובה")


async def extract_tasks_claude(
    image_base64: str, 
    api_key: str, 
    context: Optional[str] = None
) -> ScreenshotTaskExtractResponse:
    """Extract tasks from screenshot using Claude Vision"""
    
    context_text = f"\nהקשר נוסף: {context}" if context else ""
    
    prompt = f"""אנא נתח את צילום המסך הזה וחלץ את כל המשימות, פעולות נדרשות, או נקודות מעקב.
{context_text}

לכל משימה, ספק:
- title: תיאור קצר
- description: פרטים נוספים (אופציונלי)
- priority: "low" / "medium" / "high"
- person_name: שם האדם הקשור (אם מופיע)
- due_date: תאריך יעד בפורמט YYYY-MM-DD (אם מופיע)

החזר JSON בלבד:
{{
  "meeting_title": "שם הישיבה (אם נראה)",
  "summary": "סיכום קצר",
  "tasks": [{{"title": "...", "description": "...", "priority": "medium", "person_name": "...", "due_date": "..."}}]
}}
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
                "max_tokens": 3000,
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
                            {"type": "text", "text": prompt}
                        ]
                    }
                ]
            },
            timeout=90.0
        )
        
        if response.status_code != 200:
            raise Exception(f"Claude API error: {response.text}")
        
        result = response.json()
        content = result["content"][0]["text"]
        
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            data = json.loads(json_match.group())
            tasks = [ExtractedTask(**t) for t in data.get("tasks", [])]
            return ScreenshotTaskExtractResponse(
                tasks=tasks,
                total=len(tasks),
                meeting_title=data.get("meeting_title"),
                summary=data.get("summary")
            )
        
        return ScreenshotTaskExtractResponse(tasks=[], total=0)


async def extract_tasks_openai(
    image_base64: str, 
    api_key: str, 
    context: Optional[str] = None
) -> ScreenshotTaskExtractResponse:
    """Extract tasks from screenshot using OpenAI Vision"""
    
    context_text = f"\nAdditional context: {context}" if context else ""
    
    prompt = f"""Analyze this screenshot and extract all tasks, action items, or follow-up points.
{context_text}

For each task, provide in JSON:
- title: short description (in Hebrew if content is Hebrew)
- description: additional details (optional)
- priority: "low" / "medium" / "high"
- person_name: related person (if shown)
- due_date: due date in YYYY-MM-DD (if shown)

Return JSON only:
{{
  "meeting_title": "meeting name (if visible)",
  "summary": "brief summary",
  "tasks": [{{"title": "...", "description": "...", "priority": "medium", "person_name": "...", "due_date": "..."}}]
}}
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
                "max_tokens": 3000,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/png;base64,{image_base64}"}
                            },
                            {"type": "text", "text": prompt}
                        ]
                    }
                ]
            },
            timeout=90.0
        )
        
        if response.status_code != 200:
            raise Exception(f"OpenAI API error: {response.text}")
        
        result = response.json()
        content = result["choices"][0]["message"]["content"]
        
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            data = json.loads(json_match.group())
            tasks = [ExtractedTask(**t) for t in data.get("tasks", [])]
            return ScreenshotTaskExtractResponse(
                tasks=tasks,
                total=len(tasks),
                meeting_title=data.get("meeting_title"),
                summary=data.get("summary")
            )
        
        return ScreenshotTaskExtractResponse(tasks=[], total=0)






