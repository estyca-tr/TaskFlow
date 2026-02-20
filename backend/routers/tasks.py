from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime

from database import get_db
from models import Task, Employee, Meeting
from schemas import (
    TaskCreate, TaskUpdate, TaskResponse, 
    TasksListResponse, ExtractTasksRequest, ExtractTasksResponse
)

router = APIRouter()


def build_task_response(task: Task, db: Session) -> TaskResponse:
    """Build a TaskResponse with person name"""
    person_name = None
    if task.person_id:
        person = db.query(Employee).filter(Employee.id == task.person_id).first()
        if person:
            person_name = person.name
    
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
    db: Session = Depends(get_db)
):
    """Get all tasks with optional filtering"""
    query = db.query(Task)
    
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
    db: Session = Depends(get_db)
):
    """Get personal tasks only (not related to a person)"""
    query = db.query(Task).filter(Task.task_type == "personal")
    
    if status:
        query = query.filter(Task.status == status)
    
    tasks = query.order_by(Task.due_date.asc().nullslast(), Task.created_at.desc()).all()
    
    return [build_task_response(task, db) for task in tasks]


@router.get("/discuss/{person_id}", response_model=List[TaskResponse])
def get_discussion_topics(
    person_id: int,
    include_completed: bool = False,
    db: Session = Depends(get_db)
):
    """Get discussion topics for a specific person"""
    # Verify person exists
    person = db.query(Employee).filter(Employee.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    
    query = db.query(Task).filter(
        Task.task_type == "discuss_with",
        Task.person_id == person_id
    )
    
    if not include_completed:
        query = query.filter(Task.status != "completed")
    
    tasks = query.order_by(Task.priority.desc(), Task.created_at.desc()).all()
    
    return [build_task_response(task, db) for task in tasks]


@router.get("/today", response_model=List[TaskResponse])
def get_today_tasks(db: Session = Depends(get_db)):
    """Get tasks due today or overdue"""
    today = datetime.now().replace(hour=23, minute=59, second=59)
    
    tasks = db.query(Task).filter(
        Task.status.in_(["pending", "in_progress"]),
        Task.due_date <= today
    ).order_by(Task.due_date.asc()).all()
    
    return [build_task_response(task, db) for task in tasks]


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    """Get a specific task by ID"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return build_task_response(task, db)


@router.post("/", response_model=TaskResponse, status_code=201)
def create_task(task: TaskCreate, db: Session = Depends(get_db)):
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
    
    db_task = Task(**task.model_dump())
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






