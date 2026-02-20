import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { ArrowRight, Plus, X, Sparkles } from 'lucide-react'
import { employeesAPI, meetingsAPI, analyticsAPI } from '../services/api'
import './NewMeeting.css'

const TOPIC_CATEGORIES = [
  { value: 'career', label: 'קריירה' },
  { value: 'feedback', label: 'משוב' },
  { value: 'blockers', label: 'חסימות' },
  { value: 'project', label: 'פרויקט' },
  { value: 'personal', label: 'אישי' },
  { value: 'learning', label: 'למידה' },
  { value: 'team', label: 'צוות' },
  { value: 'workload', label: 'עומס עבודה' }
]

function NewMeeting() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedEmployee = searchParams.get('employee')
  
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  
  const [formData, setFormData] = useState({
    employee_id: preselectedEmployee || '',
    date: new Date().toISOString().split('T')[0],
    duration_minutes: 30,
    notes: '',
    summary: '',
    topics: [],
    action_items: []
  })
  
  
  const [newTopic, setNewTopic] = useState({ name: '', category: '' })
  const [newActionItem, setNewActionItem] = useState({ description: '', assignee: 'employee' })
  
  useEffect(() => {
    loadEmployees()
  }, [])
  
  async function loadEmployees() {
    try {
      const data = await employeesAPI.getAll()
      setEmployees(data)
    } catch (err) {
      console.error('Failed to load employees:', err)
    } finally {
      setLoading(false)
    }
  }
  
  function addTopic() {
    if (!newTopic.name.trim()) return
    setFormData({
      ...formData,
      topics: [...formData.topics, { ...newTopic }]
    })
    setNewTopic({ name: '', category: '' })
  }
  
  function removeTopic(index) {
    setFormData({
      ...formData,
      topics: formData.topics.filter((_, i) => i !== index)
    })
  }
  
  function addActionItem() {
    if (!newActionItem.description.trim()) return
    setFormData({
      ...formData,
      action_items: [...formData.action_items, { ...newActionItem }]
    })
    setNewActionItem({ description: '', assignee: 'employee' })
  }
  
  function removeActionItem(index) {
    setFormData({
      ...formData,
      action_items: formData.action_items.filter((_, i) => i !== index)
    })
  }
  
  async function handleAnalyze() {
    if (!formData.notes.trim()) {
      alert('יש להזין הערות לפני הניתוח')
      return
    }
    
    setAnalyzing(true)
    try {
      // First save the meeting to get an ID
      const meeting = await meetingsAPI.create({
        ...formData,
        employee_id: parseInt(formData.employee_id),
        date: new Date(formData.date).toISOString()
      })
      
      // Then analyze it
      const analysis = await analyticsAPI.analyzeMeeting(meeting.id, formData.notes)
      
      // Update form with AI suggestions
      setFormData({
        ...formData,
        topics: [
          ...formData.topics,
          ...analysis.topics.map(t => ({ name: t, category: '' }))
        ],
        action_items: [
          ...formData.action_items,
          ...analysis.action_items_suggested.map(a => ({ 
            description: a, 
            assignee: 'employee' 
          }))
        ]
      })
      
      alert(`ניתוח AI:\n\nתובנות: ${analysis.insights}\n\nסנטימנט: ${analysis.sentiment}`)
      
      // Navigate to the created meeting
      navigate(`/meetings/${meeting.id}`)
    } catch (err) {
      console.error('Analysis failed:', err)
      alert('שגיאה בניתוח')
    } finally {
      setAnalyzing(false)
    }
  }
  
  async function handleSubmit(e) {
    e.preventDefault()
    if (!formData.employee_id) {
      alert('יש לבחור עובד')
      return
    }
    
    setSaving(true)
    try {
      const meeting = await meetingsAPI.create({
        ...formData,
        employee_id: parseInt(formData.employee_id),
        date: new Date(formData.date).toISOString()
      })
      navigate(`/meetings/${meeting.id}`)
    } catch (err) {
      console.error('Failed to save:', err)
      alert('שגיאה בשמירה')
    } finally {
      setSaving(false)
    }
  }
  
  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    )
  }
  
  return (
    <div className="new-meeting">
      <header className="page-header">
        <div className="header-back">
          <Link to="/" className="btn btn-icon">
            <ArrowRight size={20} />
          </Link>
          <h1>שיחה חדשה</h1>
        </div>
      </header>
      
      <form onSubmit={handleSubmit} className="meeting-form">
        <div className="form-grid">
          {/* Basic info */}
          <div className="card">
            <h3>פרטי השיחה</h3>
            
            <div className="form-group">
              <label className="form-label">עם מי השיחה? *</label>
              <select
                className="form-select"
                value={formData.employee_id}
                onChange={e => setFormData({ ...formData, employee_id: e.target.value })}
              >
                <option value="">בחר אדם...</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} {emp.person_type === 'colleague' ? '(קולגה)' : emp.person_type === 'manager' ? '(מנהל)' : '(עובד)'}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">תאריך</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">משך (דקות)</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.duration_minutes}
                  onChange={e => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
                  min="5"
                  max="180"
                />
              </div>
            </div>
            
            <div className="form-group">
              <label className="form-label">סיכום קצר</label>
              <input
                type="text"
                className="form-input"
                value={formData.summary}
                onChange={e => setFormData({ ...formData, summary: e.target.value })}
                placeholder="סיכום בשורה אחת..."
              />
            </div>
          </div>
          
          </div>
        
        {/* Notes */}
        <div className="card">
          <div className="card-header">
            <h3>הערות</h3>
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={handleAnalyze}
              disabled={analyzing}
            >
              <Sparkles size={16} />
              {analyzing ? 'מנתח...' : 'נתח עם AI'}
            </button>
          </div>
          <textarea
            className="form-textarea notes-area"
            value={formData.notes}
            onChange={e => setFormData({ ...formData, notes: e.target.value })}
            placeholder="הערות מהשיחה... כתוב כאן את עיקרי הדברים שעלו"
          />
        </div>
        
        {/* Topics */}
        <div className="card">
          <h3>נושאים</h3>
          
          <div className="items-list">
            {formData.topics.map((topic, index) => (
              <div key={index} className="item-tag">
                <span>{topic.name}</span>
                {topic.category && (
                  <span className="item-category">
                    {TOPIC_CATEGORIES.find(c => c.value === topic.category)?.label}
                  </span>
                )}
                <button type="button" onClick={() => removeTopic(index)}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          
          <div className="add-item-row">
            <input
              type="text"
              className="form-input"
              value={newTopic.name}
              onChange={e => setNewTopic({ ...newTopic, name: e.target.value })}
              placeholder="שם הנושא"
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTopic())}
            />
            <select
              className="form-select"
              value={newTopic.category}
              onChange={e => setNewTopic({ ...newTopic, category: e.target.value })}
            >
              <option value="">קטגוריה</option>
              {TOPIC_CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
            <button type="button" className="btn btn-secondary" onClick={addTopic}>
              <Plus size={16} />
            </button>
          </div>
        </div>
        
        {/* Action Items */}
        <div className="card">
          <h3>פעולות נדרשות</h3>
          
          <div className="items-list">
            {formData.action_items.map((item, index) => (
              <div key={index} className="action-item-tag">
                <span>{item.description}</span>
                <span className="item-assignee">
                  {item.assignee === 'manager' ? 'מנהל' : 'עובד'}
                </span>
                <button type="button" onClick={() => removeActionItem(index)}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          
          <div className="add-item-row">
            <input
              type="text"
              className="form-input"
              value={newActionItem.description}
              onChange={e => setNewActionItem({ ...newActionItem, description: e.target.value })}
              placeholder="תיאור הפעולה"
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addActionItem())}
            />
            <select
              className="form-select"
              value={newActionItem.assignee}
              onChange={e => setNewActionItem({ ...newActionItem, assignee: e.target.value })}
            >
              <option value="employee">עובד</option>
              <option value="manager">מנהל</option>
            </select>
            <button type="button" className="btn btn-secondary" onClick={addActionItem}>
              <Plus size={16} />
            </button>
          </div>
        </div>
        
        {/* Actions */}
        <div className="form-actions">
          <Link to="/" className="btn btn-secondary">ביטול</Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'שומר...' : 'שמור שיחה'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default NewMeeting
