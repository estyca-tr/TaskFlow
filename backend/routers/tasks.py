from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional
from datetime import datetime

from database import get_db
from models import Task, Employee, Meeting, User
from schemas import (
    TaskCreate, TaskUpdate, TaskResponse, 
    TasksListResponse, ExtractTasksRequest, ExtractTasksResponse
)

router = APIRouter()


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






