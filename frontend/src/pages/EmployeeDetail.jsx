import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowRight, Calendar, Plus, TrendingUp, CheckCircle2, Circle, MessageSquare, Trash2, Users, Briefcase, Crown } from 'lucide-react'
import { employeesAPI, meetingsAPI, analyticsAPI, tasksAPI } from '../services/api'
import { format, parseISO } from 'date-fns'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import './EmployeeDetail.css'

function EmployeeDetail() {
  const { id } = useParams()
  const [employee, setEmployee] = useState(null)
  const [meetings, setMeetings] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [discussionTopics, setDiscussionTopics] = useState([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    loadData()
  }, [id])
  
  async function loadData() {
    try {
      setLoading(true)
      const [empData, meetingsData, analyticsData, topicsData] = await Promise.all([
        employeesAPI.getById(id),
        meetingsAPI.getAll({ employee_id: id }),
        analyticsAPI.getEmployeeAnalytics(id),
        tasksAPI.getDiscussTopics(id, true)
      ])
      setEmployee(empData)
      setMeetings(meetingsData)
      setAnalytics(analyticsData)
      setDiscussionTopics(topicsData || [])
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }
  
  async function handleToggleTopicComplete(topic) {
    try {
      if (topic.status === 'completed') {
        await tasksAPI.update(topic.id, { status: 'pending' })
      } else {
        await tasksAPI.complete(topic.id)
      }
      loadData()
    } catch (err) {
      console.error('Error updating topic:', err)
    }
  }
  
  async function handleDeleteTopic(topicId) {
    if (!confirm('האם למחוק את הנושא?')) return
    try {
      await tasksAPI.delete(topicId)
      loadData()
    } catch (err) {
      console.error('Error deleting topic:', err)
    }
  }
  
  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    )
  }
  
  if (!employee) {
    return (
      <div className="empty-state">
        <p>העובד לא נמצא</p>
        <Link to="/people" className="btn btn-primary mt-md">חזרה לרשימה</Link>
      </div>
    )
  }
  
  const isColleague = employee?.person_type === 'colleague'
  const isManager = employee?.person_type === 'manager'
  const isNotEmployee = isColleague || isManager
  
  
  return (
    <div className={`employee-detail ${isNotEmployee ? 'non-employee-view' : 'employee-view'}`}>
      {/* Header */}
      <header className="page-header">
        <div className="header-back">
          <Link to="/people" className="btn btn-icon">
            <ArrowRight size={20} />
          </Link>
          <div className="employee-title">
            <div className={`employee-avatar-lg ${employee.person_type}`}>
              {employee.name[0]}
            </div>
            <div>
              <div className="name-with-badge">
                <h1>{employee.name}</h1>
                <span className={`person-type-badge ${employee.person_type}`}>
                  {isManager ? <Crown size={12} /> : isColleague ? <Users size={12} /> : <Briefcase size={12} />}
                  {isManager ? 'מנהל' : isColleague ? 'קולגה' : 'עובד'}
                </span>
              </div>
              <p className="employee-subtitle">
                {employee.role || 'לא צוין תפקיד'}
                {employee.department && ` • ${employee.department}`}
              </p>
            </div>
          </div>
        </div>
        <Link to={`/meetings/new?employee=${id}`} className="btn btn-primary">
          <Plus size={18} />
          שיחה חדשה
        </Link>
      </header>
      
      {/* Stats - Different for colleagues vs employees */}
      <div className={`stats-grid ${isNotEmployee ? 'non-employee-stats' : ''}`}>
        <div className="stat-card">
          <div className="stat-value">{analytics?.total_meetings || 0}</div>
          <div className="stat-label">שיחות</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{discussionTopics.filter(t => t.status !== 'completed').length}</div>
          <div className="stat-label">נושאים לדיון</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{analytics?.pending_action_items || 0}</div>
          <div className="stat-label">משימות פתוחות</div>
        </div>
      </div>
      
      {/* Main content */}
      <div className="detail-content">
        
        {/* Top topics - Only for employees */}
        {!isNotEmployee && analytics?.top_topics?.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h3>נושאים מובילים</h3>
            </div>
            <div className="topics-list">
              {analytics.top_topics.map((topic, index) => (
                <div key={index} className="topic-bar">
                  <span className="topic-name">{topic.topic}</span>
                  <div className="topic-bar-fill" style={{ 
                    width: `${(topic.count / analytics.top_topics[0].count) * 100}%` 
                  }}>
                    <span className="topic-count">{topic.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Section Divider - Discussion Topics */}
        <div className="section-divider">
          <div className="section-divider-line"></div>
          <span className="section-divider-text">
            <MessageSquare size={16} />
            נושאים לדיון
          </span>
          <div className="section-divider-line"></div>
        </div>
        
        {/* Discussion Topics */}
        <div className="card discussion-card">
          <div className="card-header">
            <span className="topics-count">
              {discussionTopics.filter(t => t.status !== 'completed').length} נושאים פתוחים
            </span>
          </div>
          
          {discussionTopics.length > 0 ? (
            <div className="discussion-list">
              {discussionTopics.map(topic => (
                <div 
                  key={topic.id} 
                  className={`discussion-item ${topic.status === 'completed' ? 'completed' : ''}`}
                >
                  <button 
                    className={`topic-checkbox ${topic.status === 'completed' ? 'checked' : ''}`}
                    onClick={() => handleToggleTopicComplete(topic)}
                  >
                    {topic.status === 'completed' ? (
                      <CheckCircle2 size={20} />
                    ) : (
                      <Circle size={20} />
                    )}
                  </button>
                  
                  <div className="topic-content">
                    <span className="topic-title">{topic.title}</span>
                    {topic.description && (
                      <span className="topic-desc">{topic.description}</span>
                    )}
                    {topic.due_date && (
                      <span className="topic-due">
                        <Calendar size={12} />
                        {format(parseISO(topic.due_date), 'd/M/yyyy')}
                      </span>
                    )}
                  </div>
                  
                  <div className="topic-priority" data-priority={topic.priority}>
                    {topic.priority === 'high' ? '🔴' : topic.priority === 'medium' ? '🟡' : '🟢'}
                  </div>
                  
                  <button 
                    className="topic-delete"
                    onClick={() => handleDeleteTopic(topic.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-topics">
              <MessageSquare size={32} />
              <p>אין נושאים לדיון</p>
              <span>הוסף נושאים מהמשימות שלי</span>
            </div>
          )}
        </div>
        
        {/* Section Divider - Meetings */}
        <div className="section-divider">
          <div className="section-divider-line"></div>
          <span className="section-divider-text">
            <Calendar size={16} />
            היסטוריית שיחות
          </span>
          <div className="section-divider-line"></div>
        </div>
        
        {/* Meetings list */}
        <div className="card meetings-card">
          {meetings.length > 0 ? (
            <div className="meetings-timeline">
              {meetings.map(meeting => (
                <Link 
                  key={meeting.id} 
                  to={`/meetings/${meeting.id}`}
                  className="timeline-item"
                >
                  <div className="timeline-date">
                    <Calendar size={16} />
                    {format(parseISO(meeting.date), 'd/M/yyyy')}
                  </div>
                  
                  {meeting.summary && (
                    <p className="timeline-summary">{meeting.summary}</p>
                  )}
                  
                  <div className="timeline-meta">
                    {meeting.action_items?.length > 0 && (
                      <span className="timeline-actions">
                        {meeting.action_items.filter(i => i.status === 'completed').length}/
                        {meeting.action_items.length} משימות הושלמו
                      </span>
                    )}
                  </div>
                  
                  {meeting.topics?.length > 0 && (
                    <div className="timeline-topics">
                      {meeting.topics.map(topic => (
                        <span key={topic.id} className="badge badge-info">
                          {topic.name}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Calendar size={48} />
              <p>אין שיחות עדיין</p>
              <Link to={`/meetings/new?employee=${id}`} className="btn btn-primary mt-md">
                צור שיחה ראשונה
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default EmployeeDetail
