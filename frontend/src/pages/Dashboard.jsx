import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  Users, Calendar, AlertCircle, ArrowLeft, 
  CheckCircle2, Clock, CheckSquare, Sparkles, Target, Plus,
  StickyNote, Pin, Copy, FileText, Link as LinkIcon, Key, User, Code
} from 'lucide-react'
import { analyticsAPI, meetingsAPI, tasksAPI, quickNotesAPI } from '../services/api'
import { format, parseISO } from 'date-fns'
import './Dashboard.css'

function Dashboard() {
  const [overview, setOverview] = useState(null)
  const [recentMeetings, setRecentMeetings] = useState([])
  const [todayTasks, setTodayTasks] = useState([])
  const [quickNotes, setQuickNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  useEffect(() => {
    loadData()
  }, [])
  
  async function loadData() {
    try {
      setLoading(true)
      const [overviewData, meetingsData, todayData, notesData] = await Promise.all([
        analyticsAPI.getOverview(),
        meetingsAPI.getAll({ limit: 5 }),
        tasksAPI.getToday(),
        quickNotesAPI.getAll()
      ])
      setOverview(overviewData)
      setRecentMeetings(meetingsData)
      setTodayTasks(todayData.slice(0, 5))
      // Show pinned notes first, then recent notes, max 4
      const sortedNotes = (notesData.notes || [])
        .sort((a, b) => b.is_pinned - a.is_pinned)
        .slice(0, 4)
      setQuickNotes(sortedNotes)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  
  async function handleCompleteTask(taskId) {
    try {
      await tasksAPI.complete(taskId)
      loadData()
    } catch (err) {
      console.error('Error completing task:', err)
    }
  }
  
  function handleCopyNote(content) {
    navigator.clipboard.writeText(content)
  }
  
  const categoryIcons = {
    general: FileText,
    link: LinkIcon,
    credentials: Key,
    contact: User,
    code: Code,
  }
  
  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="error-state">
        <AlertCircle size={48} />
        <h2>אופס! משהו השתבש</h2>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={loadData}>נסה שוב</button>
      </div>
    )
  }
  
  const greeting = getGreeting()
  
  return (
    <div className="dashboard animate-fade-in">
      {/* Hero Section */}
      <header className="dashboard-hero">
        <div className="hero-content">
          <div className="hero-greeting">
            <Sparkles className="greeting-icon" size={28} />
            <div>
              <h1>{greeting}</h1>
              <p className="hero-subtitle">הנה הסיכום שלך להיום</p>
            </div>
          </div>
          <Link to="/tasks" className="btn btn-primary">
            <Plus size={18} />
            משימה חדשה
          </Link>
        </div>
      </header>
      
      {/* Quick Stats */}
      <div className="stats-grid stagger">
        <div className="stat-card">
          <div className="stat-icon-wrapper tasks">
            <Target size={22} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{todayTasks.length}</div>
            <div className="stat-label">משימות להיום</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon-wrapper people">
            <Users size={22} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{overview?.total_employees || 0}</div>
            <div className="stat-label">אנשים</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon-wrapper meetings">
            <Calendar size={22} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{overview?.total_meetings || 0}</div>
            <div className="stat-label">פגישות</div>
          </div>
        </div>
      </div>
      
      {/* Main Grid */}
      <div className="dashboard-grid">
        {/* Today's Tasks */}
        <div className="card card-tasks">
          <div className="card-header">
            <div className="card-title">
              <CheckSquare size={18} className="card-icon" />
              <h3>משימות להיום</h3>
            </div>
            <Link to="/tasks" className="card-link">
              הכל
              <ArrowLeft size={14} />
            </Link>
          </div>
          
          {todayTasks.length > 0 ? (
            <div className="today-tasks-list stagger">
              {todayTasks.map(task => (
                <div key={task.id} className="today-task-item">
                  <button 
                    className="task-check-btn"
                    onClick={() => handleCompleteTask(task.id)}
                    title="סמן כהושלם"
                  >
                    <CheckCircle2 size={20} />
                  </button>
                  <div className="task-info">
                    <div className="task-title">{task.title}</div>
                    <div className="task-meta">
                      {task.person_name && (
                        <span className="meta-tag person">
                          <Users size={12} />
                          {task.person_name}
                        </span>
                      )}
                      {task.due_date && (
                        <span className="meta-tag time">
                          <Clock size={12} />
                          {format(parseISO(task.due_date), 'd/M')}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`priority-badge ${task.priority}`}>
                    {task.priority === 'high' ? '!' : task.priority === 'medium' ? '·' : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state small">
              <CheckSquare size={32} />
              <p>אין משימות להיום - יום נקי!</p>
            </div>
          )}
        </div>
        
        {/* Recent Meetings */}
        <div className="card card-meetings">
          <div className="card-header">
            <div className="card-title">
              <Calendar size={18} className="card-icon" />
              <h3>פגישות אחרונות</h3>
            </div>
            <Link to="/people" className="card-link">
              הכל
              <ArrowLeft size={14} />
            </Link>
          </div>
          
          {recentMeetings.length > 0 ? (
            <div className="meetings-list stagger">
              {recentMeetings.map(meeting => (
                <Link 
                  key={meeting.id} 
                  to={`/meetings/${meeting.id}`}
                  className="meeting-item"
                >
                  <div className="meeting-avatar">
                    {meeting.employee_name?.[0] || '?'}
                  </div>
                  <div className="meeting-info">
                    <div className="meeting-name">{meeting.employee_name}</div>
                    <div className="meeting-date">
                      {format(parseISO(meeting.date), 'd בMMMM', { locale: undefined })}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state small">
              <Calendar size={32} />
              <p>אין פגישות עדיין</p>
              <Link to="/meetings/new" className="btn btn-primary btn-sm mt-md">
                צור פגישה
              </Link>
            </div>
          )}
        </div>
        
        {/* Quick Notes */}
        <div className="card card-notes">
          <div className="card-header">
            <div className="card-title">
              <StickyNote size={18} className="card-icon" />
              <h3>פתקים מהירים</h3>
            </div>
            <Link to="/notes" className="card-link">
              הכל
              <ArrowLeft size={14} />
            </Link>
          </div>
          
          {quickNotes.length > 0 ? (
            <div className="notes-list stagger">
              {quickNotes.map(note => {
                const NoteIcon = categoryIcons[note.category] || FileText
                return (
                  <div 
                    key={note.id} 
                    className={`note-item ${note.is_pinned ? 'pinned' : ''}`}
                    onClick={() => handleCopyNote(note.content)}
                    title="לחץ להעתקה"
                  >
                    <div className="note-icon-wrapper">
                      <NoteIcon size={16} />
                    </div>
                    <div className="note-info">
                      <div className="note-title">
                        {note.is_pinned && <Pin size={12} className="pin-icon" />}
                        {note.title}
                      </div>
                      <div className="note-content-preview">{note.content}</div>
                    </div>
                    <Copy size={14} className="copy-hint" />
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="empty-state small">
              <StickyNote size={32} />
              <p>אין פתקים עדיין</p>
              <Link to="/notes" className="btn btn-primary btn-sm mt-md">
                צור פתק
              </Link>
            </div>
          )}
        </div>
        
        {/* Topics */}
        {overview?.top_topics?.length > 0 && (
          <div className="card card-topics">
            <div className="card-header">
              <div className="card-title">
                <TrendingUp size={18} className="card-icon" />
                <h3>נושאים מובילים</h3>
              </div>
            </div>
            <div className="topics-grid stagger">
              {overview.top_topics.slice(0, 6).map((topic, index) => (
                <div key={index} className="topic-chip">
                  <span className="topic-name">{topic.topic}</span>
                  <span className="topic-count">{topic.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'בוקר טוב!'
  if (hour < 17) return 'צהריים טובים!'
  if (hour < 21) return 'ערב טוב!'
  return 'לילה טוב!'
}

export default Dashboard
