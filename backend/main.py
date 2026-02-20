import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from contextlib import asynccontextmanager

from database import init_db
from routers import employees, meetings, analytics, tasks, calendar_meetings, quick_notes


class ProxyHeadersMiddleware(BaseHTTPMiddleware):
    """Handle X-Forwarded-Proto header for HTTPS behind proxy"""
    async def dispatch(self, request: Request, call_next):
        # Railway and other proxies set X-Forwarded-Proto
        if request.headers.get("x-forwarded-proto") == "https":
            request.scope["scheme"] = "https"
        return await call_next(request)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup"""
    init_db()
    yield


app = FastAPI(
    title="TaskFlow API",
    description="API for managing tasks, meetings, and team collaboration",
    version="2.0.0",
    lifespan=lifespan,
    root_path=""  # Let the proxy handle paths
)

# Add proxy headers middleware first
app.add_middleware(ProxyHeadersMiddleware)

# CORS configuration - allow all origins for production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
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


