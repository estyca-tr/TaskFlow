from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from contextlib import asynccontextmanager

from database import init_db
from routers import employees, meetings, analytics, tasks, calendar_meetings, quick_notes, users


class CORSHeadersMiddleware(BaseHTTPMiddleware):
    """Add CORS headers to all responses"""
    async def dispatch(self, request: Request, call_next):
        # Handle preflight OPTIONS requests
        if request.method == "OPTIONS":
            response = Response(status_code=200)
        else:
            response = await call_next(request)
        
        # Add CORS headers to all responses
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response.headers["Access-Control-Allow-Headers"] = "*"
        response.headers["Access-Control-Max-Age"] = "3600"
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup"""
    init_db()
    yield


app = FastAPI(
    title="TaskFlow API",
    description="API for managing tasks, meetings, and team collaboration",
    version="2.0.0",
    lifespan=lifespan
)

# Add custom CORS middleware (handles both preflight and regular requests)
app.add_middleware(CORSHeadersMiddleware)

# Include routers
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(employees.router, prefix="/api/employees", tags=["Employees"])
app.include_router(meetings.router, prefix="/api/meetings", tags=["Meetings"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["Tasks"])
app.include_router(calendar_meetings.router, prefix="/api/calendar", tags=["Calendar Meetings"])
app.include_router(quick_notes.router, prefix="/api/notes", tags=["Quick Notes"])


@app.get("/")
async def root():
    return {
        "message": "One-on-One Manager API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


