from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional

from database import get_db
from models import Employee, Meeting, Task
from schemas import EmployeeCreate, EmployeeUpdate, EmployeeResponse

router = APIRouter()


@router.get("/", response_model=List[EmployeeResponse])
def get_employees(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    active_only: bool = Query(True),
    person_type: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all employees/people with optional filtering"""
    query = db.query(Employee)
    
    if active_only:
        query = query.filter(Employee.is_active == True)
    
    if person_type:
        query = query.filter(Employee.person_type == person_type)
    
    if search:
        query = query.filter(
            Employee.name.ilike(f"%{search}%") |
            Employee.role.ilike(f"%{search}%") |
            Employee.department.ilike(f"%{search}%")
        )
    
    employees = query.offset(skip).limit(limit).all()
    
    # Add meeting count, last meeting date, and pending discussion topics
    result = []
    for emp in employees:
        meeting_count = db.query(func.count(Meeting.id)).filter(Meeting.employee_id == emp.id).scalar()
        last_meeting = db.query(func.max(Meeting.date)).filter(Meeting.employee_id == emp.id).scalar()
        pending_topics = db.query(func.count(Task.id)).filter(
            Task.person_id == emp.id,
            Task.task_type == "discuss_with",
            Task.status != "completed"
        ).scalar()
        
        emp_dict = {
            "id": emp.id,
            "name": emp.name,
            "role": emp.role,
            "department": emp.department,
            "email": emp.email,
            "start_date": emp.start_date,
            "notes": emp.notes,
            "person_type": emp.person_type or "employee",
            "is_active": emp.is_active,
            "created_at": emp.created_at,
            "updated_at": emp.updated_at,
            "meeting_count": meeting_count,
            "last_meeting_date": last_meeting,
            "pending_discussion_topics": pending_topics
        }
        result.append(EmployeeResponse(**emp_dict))
    
    return result


@router.get("/{employee_id}", response_model=EmployeeResponse)
def get_employee(employee_id: int, db: Session = Depends(get_db)):
    """Get a specific employee/person by ID"""
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Person not found")
    
    meeting_count = db.query(func.count(Meeting.id)).filter(Meeting.employee_id == employee.id).scalar()
    last_meeting = db.query(func.max(Meeting.date)).filter(Meeting.employee_id == employee.id).scalar()
    pending_topics = db.query(func.count(Task.id)).filter(
        Task.person_id == employee.id,
        Task.task_type == "discuss_with",
        Task.status != "completed"
    ).scalar()
    
    emp_dict = {
        "id": employee.id,
        "name": employee.name,
        "role": employee.role,
        "department": employee.department,
        "email": employee.email,
        "start_date": employee.start_date,
        "notes": employee.notes,
        "person_type": employee.person_type or "employee",
        "is_active": employee.is_active,
        "created_at": employee.created_at,
        "updated_at": employee.updated_at,
        "meeting_count": meeting_count,
        "last_meeting_date": last_meeting,
        "pending_discussion_topics": pending_topics
    }
    
    return EmployeeResponse(**emp_dict)


@router.post("/", response_model=EmployeeResponse, status_code=201)
def create_employee(employee: EmployeeCreate, db: Session = Depends(get_db)):
    """Create a new employee/person"""
    db_employee = Employee(**employee.model_dump())
    db.add(db_employee)
    db.commit()
    db.refresh(db_employee)
    
    return EmployeeResponse(
        id=db_employee.id,
        name=db_employee.name,
        role=db_employee.role,
        department=db_employee.department,
        email=db_employee.email,
        start_date=db_employee.start_date,
        notes=db_employee.notes,
        person_type=db_employee.person_type or "employee",
        is_active=db_employee.is_active,
        created_at=db_employee.created_at,
        updated_at=db_employee.updated_at,
        meeting_count=0,
        last_meeting_date=None,
        pending_discussion_topics=0
    )


@router.put("/{employee_id}", response_model=EmployeeResponse)
def update_employee(employee_id: int, employee: EmployeeUpdate, db: Session = Depends(get_db)):
    """Update an existing employee/person"""
    db_employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not db_employee:
        raise HTTPException(status_code=404, detail="Person not found")
    
    update_data = employee.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_employee, key, value)
    
    db.commit()
    db.refresh(db_employee)
    
    meeting_count = db.query(func.count(Meeting.id)).filter(Meeting.employee_id == db_employee.id).scalar()
    last_meeting = db.query(func.max(Meeting.date)).filter(Meeting.employee_id == db_employee.id).scalar()
    pending_topics = db.query(func.count(Task.id)).filter(
        Task.person_id == db_employee.id,
        Task.task_type == "discuss_with",
        Task.status != "completed"
    ).scalar()
    
    return EmployeeResponse(
        id=db_employee.id,
        name=db_employee.name,
        role=db_employee.role,
        department=db_employee.department,
        email=db_employee.email,
        start_date=db_employee.start_date,
        notes=db_employee.notes,
        person_type=db_employee.person_type or "employee",
        is_active=db_employee.is_active,
        created_at=db_employee.created_at,
        updated_at=db_employee.updated_at,
        meeting_count=meeting_count,
        last_meeting_date=last_meeting,
        pending_discussion_topics=pending_topics
    )


@router.delete("/{employee_id}", status_code=204)
def delete_employee(employee_id: int, hard_delete: bool = False, db: Session = Depends(get_db)):
    """Delete an employee (soft delete by default)"""
    db_employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not db_employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    if hard_delete:
        db.delete(db_employee)
    else:
        db_employee.is_active = False
    
    db.commit()
    return None


