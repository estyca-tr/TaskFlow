import { useState, useEffect, useRef } from 'react'
import { 
  CheckCircle2, Circle, Clock, Plus, Filter, 
  User, Calendar, MessageSquare, AlertCircle,
  Trash2, Target, Sparkles, X, Edit3, PlayCircle, Save, Search,
  ChevronRight, ChevronLeft
} from 'lucide-react'
import { tasksAPI, employeesAPI } from '../services/api'
import { 
  format, parseISO, isToday, isPast, 
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay
} from 'date-fns'
import { he } from 'date-fns/locale'
import './MyTasks.css'

const TASK_TYPES = {
  all: { label: 'הכל', icon: null, color: '' },
  personal: { label: 'אישי', icon: User, color: 'purple' },
  discuss_with: { label: 'לדיון', icon: MessageSquare, color: 'green' },
  from_meeting: { label: 'מישיבה', icon: Calendar, color: 'amber' }
}

const PRIORITIES = {
  high: { label: 'גבוהה', emoji: '🔴' },
  medium: { label: 'בינונית', emoji: '🟡' },
  low: { label: 'נמוכה', emoji: '🟢' }
}

const STATUSES = {
  pending: { label: 'ממתין', icon: Circle, color: 'gray' },
  in_progress: { label: 'בביצוע', icon: PlayCircle, color: 'blue' },
  completed: { label: 'הושלם', icon: CheckCircle2, color: 'green' }
}

function MyTasks() {
  const [tasks, setTasks] = useState([])
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('active')
  const [showNewTask, setShowNewTask] = useState(false)
  const [stats, setStats] = useState({ total: 0, pending: 0, in_progress: 0, completed: 0 })
  
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    task_type: 'personal',
    priority: 'medium',
    due_date: '',
    person_id: null
  })
  
  const [editingTask, setEditingTask] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [personSearch, setPersonSearch] = useState('')
  const [showPersonDropdown, setShowPersonDropdown] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [showEditCalendar, setShowEditCalendar] = useState(false)
  const [editCalendarMonth, setEditCalendarMonth] = useState(new Date())
  const personSearchRef = useRef(null)
  
  useEffect(() => {
    loadData()
  }, [filter, statusFilter])
  
  useEffect(() => {
    function handleClickOutside(e) {
      if (personSearchRef.current && !personSearchRef.current.contains(e.target)) {
        setShowPersonDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  async function loadData() {
    try {
      setLoading(true)
      const params = {}
      
      if (filter !== 'all') {
        params.task_type = filter
      }
      
      if (statusFilter === 'active') {
        params.status = 'pending'
      } else if (statusFilter === 'completed') {
        params.status = 'completed'
      }
      
      const [tasksData, peopleData] = await Promise.all([
        tasksAPI.getAll(params),
        employeesAPI.getAll()
      ])
      
      setTasks(tasksData.tasks || [])
      setStats({
        total: tasksData.total || 0,
        pending: tasksData.pending || 0,
        in_progress: tasksData.in_progress || 0,
        completed: tasksData.completed || 0
      })
      setPeople(peopleData)
    } catch (err) {
      console.error('Error loading tasks:', err)
    } finally {
      setLoading(false)
    }
  }
  
  function closeNewTaskModal() {
    setShowNewTask(false)
    setPersonSearch('')
    setShowPersonDropdown(false)
    setShowCalendar(false)
  }
  
  function getCalendarDays(month) {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 })
    const days = []
    let day = start
    while (day <= end) {
      days.push(day)
      day = addDays(day, 1)
    }
    return days
  }
  
  function selectDate(date, isEdit = false) {
    const dateStr = format(date, 'yyyy-MM-dd')
    if (isEdit) {
      setEditingTask({ ...editingTask, due_date: dateStr })
      setShowEditCalendar(false)
    } else {
      setNewTask({ ...newTask, due_date: dateStr })
      setShowCalendar(false)
    }
  }
  
  
  async function handleCreateTask(e) {
    e.preventDefault()
    try {
      const taskData = { ...newTask }
      if (!taskData.due_date) delete taskData.due_date
      if (!taskData.person_id) delete taskData.person_id
      if (taskData.due_date) {
        taskData.due_date = new Date(taskData.due_date).toISOString()
      }
      
      await tasksAPI.create(taskData)
      closeNewTaskModal()
      setNewTask({
        title: '',
        description: '',
        task_type: 'personal',
        priority: 'medium',
        due_date: '',
        person_id: null
      })
      loadData()
    } catch (err) {
      console.error('Error creating task:', err)
    }
  }
  
  async function handleToggleComplete(task) {
    try {
      if (task.status === 'completed') {
        await tasksAPI.update(task.id, { status: 'pending' })
      } else {
        await tasksAPI.complete(task.id)
      }
      loadData()
    } catch (err) {
      console.error('Error updating task:', err)
    }
  }
  
  async function handleDeleteTask(taskId) {
    if (!confirm('האם למחוק את המשימה?')) return
    try {
      await tasksAPI.delete(taskId)
      loadData()
    } catch (err) {
      console.error('Error deleting task:', err)
    }
  }
  
  function handleEditTask(task) {
    setEditingTask({
      ...task,
      due_date: task.due_date ? task.due_date.split('T')[0] : ''
    })
    setShowEditModal(true)
  }
  
  async function handleSaveEdit(e) {
    e.preventDefault()
    try {
      const updateData = {
        title: editingTask.title,
        description: editingTask.description,
        priority: editingTask.priority,
        status: editingTask.status,
        due_date: editingTask.due_date ? new Date(editingTask.due_date).toISOString() : null
      }
      
      await tasksAPI.update(editingTask.id, updateData)
      setShowEditModal(false)
      setEditingTask(null)
      loadData()
    } catch (err) {
      console.error('Error updating task:', err)
    }
  }
  
  async function handleStatusChange(taskId, newStatus) {
    try {
      await tasksAPI.update(taskId, { status: newStatus })
      loadData()
    } catch (err) {
      console.error('Error updating status:', err)
    }
  }
  
  function getDueDateStatus(dueDate) {
    if (!dueDate) return null
    const date = parseISO(dueDate)
    if (isPast(date) && !isToday(date)) return 'overdue'
    if (isToday(date)) return 'today'
    return 'upcoming'
  }
  
  if (loading && tasks.length === 0) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    )
  }
  
  return (
    <div className="my-tasks animate-fade-in">
      {/* Header */}
      <header className="tasks-header">
        <div className="header-content">
          <div className="header-title">
            <Target className="header-icon" size={28} />
            <div>
              <h1>המשימות שלי</h1>
              <p className="header-subtitle">נהל את המשימות והנושאים שלך</p>
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowNewTask(true)}>
            <Plus size={18} />
            משימה חדשה
          </button>
        </div>
        
        {/* Stats Row */}
        <div className="stats-row">
          <div className="mini-stat">
            <span className="mini-stat-value">{stats.pending}</span>
            <span className="mini-stat-label">ממתינות</span>
          </div>
          <div className="stats-divider" />
          <div className="mini-stat">
            <span className="mini-stat-value">{stats.in_progress}</span>
            <span className="mini-stat-label">בביצוע</span>
          </div>
          <div className="stats-divider" />
          <div className="mini-stat completed">
            <span className="mini-stat-value">{stats.completed}</span>
            <span className="mini-stat-label">הושלמו</span>
          </div>
        </div>
      </header>
      
      {/* Filters */}
      <div className="filters-bar">
        <div className="filter-section">
          <span className="filter-label">
            <Filter size={14} />
            סוג:
          </span>
          <div className="filter-chips">
            {Object.entries(TASK_TYPES).map(([key, { label, color }]) => (
              <button
                key={key}
                className={`filter-chip ${filter === key ? 'active' : ''} ${color}`}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        
        <div className="filter-section">
          <span className="filter-label">סטטוס:</span>
          <div className="filter-chips">
            <button
              className={`filter-chip ${statusFilter === 'active' ? 'active' : ''}`}
              onClick={() => setStatusFilter('active')}
            >
              פעילות
            </button>
            <button
              className={`filter-chip ${statusFilter === 'completed' ? 'active' : ''}`}
              onClick={() => setStatusFilter('completed')}
            >
              הושלמו
            </button>
            <button
              className={`filter-chip ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              הכל
            </button>
          </div>
        </div>
      </div>
      
      {/* Tasks List */}
      <div className="tasks-container">
        {tasks.length === 0 ? (
          <div className="empty-tasks">
            <div className="empty-illustration">
              <Sparkles size={48} />
            </div>
            <h3>אין משימות להצגה</h3>
            <p>הוסף משימות חדשות כדי לעקוב אחרי הדברים שלך</p>
            <button className="btn btn-primary" onClick={() => setShowNewTask(true)}>
              <Plus size={18} />
              צור משימה ראשונה
            </button>
          </div>
        ) : (
          <div className="tasks-list stagger">
            {tasks.map(task => {
              const dueStatus = getDueDateStatus(task.due_date)
              const TypeIcon = TASK_TYPES[task.task_type]?.icon
              
              return (
                <div 
                  key={task.id} 
                  className={`task-card ${task.status === 'completed' ? 'completed' : ''}`}
                >
                  <button 
                    className={`task-checkbox ${task.status === 'completed' ? 'checked' : ''}`}
                    onClick={() => handleToggleComplete(task)}
                  >
                    {task.status === 'completed' ? (
                      <CheckCircle2 size={24} />
                    ) : (
                      <Circle size={24} />
                    )}
                  </button>
                  
                  <div className="task-body" onClick={() => handleEditTask(task)}>
                    <div className="task-main">
                      <h4 className="task-title">{task.title}</h4>
                      {task.description && (
                        <p className="task-desc">{task.description}</p>
                      )}
                    </div>
                    
                    <div className="task-tags">
                      <span className={`task-type-tag ${task.task_type}`}>
                        {TypeIcon && <TypeIcon size={12} />}
                        {TASK_TYPES[task.task_type]?.label}
                      </span>
                      
                      <span className={`status-tag ${task.status}`}>
                        {STATUSES[task.status]?.label}
                      </span>
                      
                      <span className={`priority-tag ${task.priority}`}>
                        {PRIORITIES[task.priority]?.emoji}
                      </span>
                      
                      {task.person_name && (
                        <span className="person-tag">
                          <User size={12} />
                          {task.person_name}
                        </span>
                      )}
                      
                      {task.due_date && (
                        <span className={`due-tag ${dueStatus}`}>
                          <Clock size={12} />
                          {format(parseISO(task.due_date), 'd/M/yyyy')}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="task-actions">
                    <button 
                      className="task-edit"
                      onClick={() => handleEditTask(task)}
                      title="ערוך משימה"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button 
                      className="task-delete"
                      onClick={() => handleDeleteTask(task.id)}
                      title="מחק משימה"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      
      {/* New Task Modal */}
      {showNewTask && (
        <div className="modal-overlay" onClick={closeNewTaskModal}>
          <div className="modal animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <Plus size={20} />
                משימה חדשה
              </h2>
              <button className="modal-close" onClick={closeNewTaskModal}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateTask}>
              <div className="form-group">
                <label className="form-label">מה צריך לעשות?</label>
                <input
                  type="text"
                  className="form-input form-input-lg"
                  value={newTask.title}
                  onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="תיאור קצר של המשימה..."
                  autoFocus
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">פרטים נוספים (אופציונלי)</label>
                <textarea
                  className="form-textarea"
                  value={newTask.description}
                  onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="הוסף פרטים, הערות, או קישורים..."
                  rows={3}
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">סוג משימה</label>
                  <div className="type-selector">
                    {['personal', 'discuss_with'].map(type => (
                      <button
                        key={type}
                        type="button"
                        className={`type-option ${newTask.task_type === type ? 'active' : ''} ${type}`}
                        onClick={() => setNewTask({ ...newTask, task_type: type, person_id: type === 'personal' ? null : newTask.person_id })}
                      >
                        {type === 'personal' ? <User size={16} /> : <MessageSquare size={16} />}
                        {type === 'personal' ? 'אישי' : 'לדיון'}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="form-group">
                  <label className="form-label">עדיפות</label>
                  <div className="priority-selector">
                    {Object.entries(PRIORITIES).map(([key, { emoji }]) => (
                      <button
                        key={key}
                        type="button"
                        className={`priority-option ${newTask.priority === key ? 'active' : ''}`}
                        onClick={() => setNewTask({ ...newTask, priority: key })}
                        title={PRIORITIES[key].label}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              {newTask.task_type === 'discuss_with' && (
                <div className="form-group">
                  <label className="form-label">עם מי לדון?</label>
                  <div className="person-search-container" ref={personSearchRef}>
                    <div className="person-search-input-wrapper">
                      <Search size={16} className="search-icon" />
                      <input
                        type="text"
                        className="form-input person-search-input"
                        placeholder="חפש לפי שם..."
                        value={personSearch}
                        onChange={e => {
                          setPersonSearch(e.target.value)
                          setShowPersonDropdown(true)
                        }}
                        onFocus={() => setShowPersonDropdown(true)}
                      />
                      {newTask.person_id && (
                        <button
                          type="button"
                          className="clear-person-btn"
                          onClick={() => {
                            setNewTask({ ...newTask, person_id: null })
                            setPersonSearch('')
                          }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    {showPersonDropdown && (
                      <div className="person-dropdown">
                        {people
                          .filter(p => p.name.toLowerCase().includes(personSearch.toLowerCase()))
                          .map(person => (
                            <div
                              key={person.id}
                              className={`person-option ${newTask.person_id === person.id ? 'selected' : ''}`}
                              onClick={() => {
                                setNewTask({ ...newTask, person_id: person.id })
                                setPersonSearch(person.name)
                                setShowPersonDropdown(false)
                              }}
                            >
                              <span className="person-name">{person.name}</span>
                              <span className={`person-type-badge ${person.person_type}`}>
                                {person.person_type === 'colleague' ? 'קולגה' : person.person_type === 'manager' ? 'מנהל' : 'עובד'}
                              </span>
                            </div>
                          ))}
                        {people.filter(p => p.name.toLowerCase().includes(personSearch.toLowerCase())).length === 0 && (
                          <div className="person-option empty">לא נמצאו תוצאות</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <div className="form-group">
                <label className="form-label">תאריך יעד</label>
                <button
                  type="button"
                  className="calendar-trigger"
                  onClick={() => setShowCalendar(true)}
                >
                  <Calendar size={18} />
                  <span>{newTask.due_date ? format(new Date(newTask.due_date), 'd בMMMM yyyy', { locale: he }) : 'בחר תאריך...'}</span>
                  {newTask.due_date && (
                    <X 
                      size={16} 
                      className="clear-date"
                      onClick={(e) => {
                        e.stopPropagation()
                        setNewTask({ ...newTask, due_date: '' })
                      }}
                    />
                  )}
                </button>
              </div>
              
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeNewTaskModal}>
                  ביטול
                </button>
                <button type="submit" className="btn btn-primary">
                  <Plus size={18} />
                  צור משימה
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Edit Task Modal */}
      {showEditModal && editingTask && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <Edit3 size={20} />
                עריכת משימה
              </h2>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveEdit}>
              <div className="form-group">
                <label className="form-label">כותרת</label>
                <input
                  type="text"
                  className="form-input form-input-lg"
                  value={editingTask.title}
                  onChange={e => setEditingTask({ ...editingTask, title: e.target.value })}
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">הערות ופרטים</label>
                <textarea
                  className="form-textarea"
                  value={editingTask.description || ''}
                  onChange={e => setEditingTask({ ...editingTask, description: e.target.value })}
                  placeholder="הוסף הערות, עדכונים, או פרטים נוספים..."
                  rows={4}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">סטטוס</label>
                <div className="status-selector">
                  {Object.entries(STATUSES).map(([key, { label, icon: Icon, color }]) => (
                    <button
                      key={key}
                      type="button"
                      className={`status-option ${editingTask.status === key ? 'active' : ''} ${color}`}
                      onClick={() => setEditingTask({ ...editingTask, status: key })}
                    >
                      <Icon size={16} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">עדיפות</label>
                  <div className="priority-selector">
                    {Object.entries(PRIORITIES).map(([key, { emoji, label }]) => (
                      <button
                        key={key}
                        type="button"
                        className={`priority-option ${editingTask.priority === key ? 'active' : ''}`}
                        onClick={() => setEditingTask({ ...editingTask, priority: key })}
                        title={label}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="form-group">
                  <label className="form-label">תאריך יעד</label>
                  <button
                    type="button"
                    className="calendar-trigger"
                    onClick={() => setShowEditCalendar(true)}
                  >
                    <Calendar size={18} />
                    <span>{editingTask.due_date ? format(new Date(editingTask.due_date), 'd בMMMM yyyy', { locale: he }) : 'בחר תאריך...'}</span>
                    {editingTask.due_date && (
                      <X 
                        size={16} 
                        className="clear-date"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingTask({ ...editingTask, due_date: '' })
                        }}
                      />
                    )}
                  </button>
                </div>
              </div>
              
              {editingTask.person_name && (
                <div className="form-group">
                  <label className="form-label">משויך ל</label>
                  <div className="linked-person">
                    <User size={16} />
                    {editingTask.person_name}
                  </div>
                </div>
              )}
              
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                  ביטול
                </button>
                <button type="submit" className="btn btn-primary">
                  <Save size={18} />
                  שמור שינויים
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Calendar Overlay for New Task */}
      {showCalendar && (
        <div className="calendar-overlay" onClick={() => setShowCalendar(false)}>
          <div className="calendar-modal" onClick={e => e.stopPropagation()}>
            <div className="calendar-modal-header">
              <h3>בחר תאריך</h3>
              <button className="modal-close" onClick={() => setShowCalendar(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="calendar-header">
              <button type="button" onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}>
                <ChevronRight size={18} />
              </button>
              <span className="calendar-month-title">
                {format(calendarMonth, 'MMMM yyyy', { locale: he })}
              </span>
              <button type="button" onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}>
                <ChevronLeft size={18} />
              </button>
            </div>
            <div className="calendar-weekdays">
              {['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map(day => (
                <div key={day} className="weekday">{day}</div>
              ))}
            </div>
            <div className="calendar-days">
              {getCalendarDays(calendarMonth).map((day, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`calendar-day ${!isSameMonth(day, calendarMonth) ? 'other-month' : ''} ${isToday(day) ? 'today' : ''} ${newTask.due_date && isSameDay(day, new Date(newTask.due_date)) ? 'selected' : ''}`}
                  onClick={() => selectDate(day)}
                >
                  {format(day, 'd')}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Calendar Overlay for Edit Task */}
      {showEditCalendar && (
        <div className="calendar-overlay" onClick={() => setShowEditCalendar(false)}>
          <div className="calendar-modal" onClick={e => e.stopPropagation()}>
            <div className="calendar-modal-header">
              <h3>בחר תאריך</h3>
              <button className="modal-close" onClick={() => setShowEditCalendar(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="calendar-header">
              <button type="button" onClick={() => setEditCalendarMonth(subMonths(editCalendarMonth, 1))}>
                <ChevronRight size={18} />
              </button>
              <span className="calendar-month-title">
                {format(editCalendarMonth, 'MMMM yyyy', { locale: he })}
              </span>
              <button type="button" onClick={() => setEditCalendarMonth(addMonths(editCalendarMonth, 1))}>
                <ChevronLeft size={18} />
              </button>
            </div>
            <div className="calendar-weekdays">
              {['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map(day => (
                <div key={day} className="weekday">{day}</div>
              ))}
            </div>
            <div className="calendar-days">
              {getCalendarDays(editCalendarMonth).map((day, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`calendar-day ${!isSameMonth(day, editCalendarMonth) ? 'other-month' : ''} ${isToday(day) ? 'today' : ''} ${editingTask?.due_date && isSameDay(day, new Date(editingTask.due_date)) ? 'selected' : ''}`}
                  onClick={() => selectDate(day, true)}
                >
                  {format(day, 'd')}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MyTasks
