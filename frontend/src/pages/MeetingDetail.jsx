import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Calendar, Clock, Edit2, Trash2, CheckCircle2, Circle, Sparkles } from 'lucide-react'
import { meetingsAPI, analyticsAPI, employeesAPI } from '../services/api'
import { format, parseISO } from 'date-fns'
import './MeetingDetail.css'

function MeetingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [meeting, setMeeting] = useState(null)
  const [person, setPerson] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  
  const isColleague = person?.person_type === 'colleague'
  const isManager = person?.person_type === 'manager'
  const isNotEmployee = isColleague || isManager
  
  useEffect(() => {
    loadMeeting()
  }, [id])
  
  async function loadMeeting() {
    try {
      setLoading(true)
      const data = await meetingsAPI.getById(id)
      setMeeting(data)
      
      // Load person data to check if colleague
      if (data.employee_id) {
        const personData = await employeesAPI.getById(data.employee_id)
        setPerson(personData)
      }
    } catch (err) {
      console.error('Failed to load meeting:', err)
    } finally {
      setLoading(false)
    }
  }
  
  async function handleDelete() {
    if (!confirm('האם למחוק את השיחה?')) return
    
    try {
      await meetingsAPI.delete(id)
      navigate('/')
    } catch (err) {
      alert('שגיאה במחיקה')
    }
  }
  
  async function toggleActionItem(item) {
    setUpdating(true)
    try {
      const newStatus = item.status === 'completed' ? 'pending' : 'completed'
      await meetingsAPI.updateActionItem(item.id, { status: newStatus })
      
      setMeeting({
        ...meeting,
        action_items: meeting.action_items.map(i => 
          i.id === item.id ? { ...i, status: newStatus } : i
        )
      })
    } catch (err) {
      console.error('Failed to update action item:', err)
    } finally {
      setUpdating(false)
    }
  }
  
  async function handleAnalyze() {
    if (!meeting.notes) {
      alert('אין הערות לניתוח')
      return
    }
    
    try {
      const analysis = await analyticsAPI.analyzeMeeting(meeting.id, meeting.notes)
      
      alert(`תובנות AI:\n\n${analysis.insights}\n\nסנטימנט: ${analysis.sentiment}`)
      
      // Reload to get updated AI fields
      loadMeeting()
    } catch (err) {
      alert('שגיאה בניתוח')
    }
  }
  
  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    )
  }
  
  if (!meeting) {
    return (
      <div className="empty-state">
        <p>השיחה לא נמצאה</p>
        <Link to="/" className="btn btn-primary mt-md">חזרה לעמוד הראשי</Link>
      </div>
    )
  }
  
  return (
    <div className="meeting-detail">
      {/* Header */}
      <header className="page-header">
        <div className="header-back">
          <Link to={`/people/${meeting.employee_id}`} className="btn btn-icon">
            <ArrowRight size={20} />
          </Link>
          <div>
            <h1>שיחה עם {meeting.employee_name}</h1>
            <p className="meeting-date-header">
              <Calendar size={16} />
              {format(parseISO(meeting.date), 'd/M/yyyy')}
              <Clock size={16} />
              {meeting.duration_minutes} דקות
            </p>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={handleAnalyze}>
            <Sparkles size={16} />
            נתח עם AI
          </button>
          <button className="btn btn-danger" onClick={handleDelete}>
            <Trash2 size={16} />
            מחק
          </button>
        </div>
      </header>
      
      {/* Content */}
      <div className="meeting-content">
        {/* Summary */}
        {meeting.summary && (
          <div className="card">
            <div className="meeting-summary">
              <h4>סיכום</h4>
              <p>{meeting.summary}</p>
            </div>
          </div>
        )}
        
        {/* AI Insights */}
        {meeting.ai_insights && (
          <div className="card ai-card">
            <div className="ai-header">
              <Sparkles size={20} />
              <h3>תובנות AI</h3>
            </div>
            <p className="ai-insights">{meeting.ai_insights}</p>
            {meeting.ai_sentiment && (
              <div className="ai-sentiment">
                סנטימנט: 
                <span className={`badge badge-${meeting.ai_sentiment === 'positive' ? 'success' : meeting.ai_sentiment === 'negative' ? 'danger' : 'neutral'}`}>
                  {meeting.ai_sentiment === 'positive' ? 'חיובי' : meeting.ai_sentiment === 'negative' ? 'שלילי' : 'ניטרלי'}
                </span>
              </div>
            )}
          </div>
        )}
        
        {/* Notes */}
        {meeting.notes && (
          <div className="card">
            <h3>הערות</h3>
            <div className="meeting-notes">
              {meeting.notes.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        )}
        
        {/* Topics */}
        {meeting.topics?.length > 0 && (
          <div className="card">
            <h3>נושאים שנדונו</h3>
            <div className="topics-grid">
              {meeting.topics.map(topic => (
                <div key={topic.id} className="topic-chip">
                  <span className="topic-name">{topic.name}</span>
                  {topic.category && (
                    <span className="topic-category">{topic.category}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Action Items */}
        {meeting.action_items?.length > 0 && (
          <div className="card">
            <h3>פעולות נדרשות</h3>
            <div className="action-items-detail">
              {meeting.action_items.map(item => (
                <div 
                  key={item.id} 
                  className={`action-item-detail ${item.status === 'completed' ? 'completed' : ''}`}
                  onClick={() => toggleActionItem(item)}
                >
                  <div className="action-check">
                    {item.status === 'completed' ? (
                      <CheckCircle2 size={20} className="check-done" />
                    ) : (
                      <Circle size={20} />
                    )}
                  </div>
                  <div className="action-content">
                    <span className="action-description">{item.description}</span>
                    <span className="action-assignee">
                      {item.assignee === 'manager' ? 'מנהל' : 'עובד'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MeetingDetail

