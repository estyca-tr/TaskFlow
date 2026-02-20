import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  Search, Plus, UserCircle, Star, Users, 
  Calendar, MessageSquare, Edit, Trash2, X,
  Briefcase, Mail, Building2, Crown
} from 'lucide-react'
import { employeesAPI } from '../services/api'
import { format, parseISO } from 'date-fns'
import './People.css'

function People() {
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingPerson, setEditingPerson] = useState(null)
  
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    department: '',
    email: '',
    person_type: 'employee',
    notes: ''
  })
  
  useEffect(() => {
    loadPeople()
  }, [filter, search])
  
  async function loadPeople() {
    try {
      setLoading(true)
      const params = {}
      if (search) params.search = search
      if (filter !== 'all') params.person_type = filter
      
      const data = await employeesAPI.getAll(params)
      setPeople(data)
    } catch (err) {
      console.error('Error loading people:', err)
    } finally {
      setLoading(false)
    }
  }
  
  function openAddModal(type = 'employee') {
    setFormData({
      name: '',
      role: '',
      department: '',
      email: '',
      person_type: type,
      notes: ''
    })
    setEditingPerson(null)
    setShowAddModal(true)
  }
  
  function openEditModal(person) {
    setFormData({
      name: person.name,
      role: person.role || '',
      department: person.department || '',
      email: person.email || '',
      person_type: person.person_type || 'employee',
      notes: person.notes || ''
    })
    setEditingPerson(person)
    setShowAddModal(true)
  }
  
  async function handleSubmit(e) {
    e.preventDefault()
    try {
      if (editingPerson) {
        await employeesAPI.update(editingPerson.id, formData)
      } else {
        await employeesAPI.create(formData)
      }
      setShowAddModal(false)
      loadPeople()
    } catch (err) {
      console.error('Error saving person:', err)
    }
  }
  
  async function handleDelete(id) {
    if (!confirm('האם למחוק?')) return
    try {
      await employeesAPI.delete(id)
      loadPeople()
    } catch (err) {
      console.error('Error deleting:', err)
    }
  }
  
  const employees = people.filter(p => p.person_type === 'employee' || !p.person_type)
  const colleagues = people.filter(p => p.person_type === 'colleague')
  const managers = people.filter(p => p.person_type === 'manager')
  
  if (loading && people.length === 0) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    )
  }
  
  return (
    <div className="people-page animate-fade-in">
      {/* Header */}
      <header className="people-header">
        <div className="header-content">
          <div className="header-title">
            <Users className="header-icon" size={28} />
            <div>
              <h1>אנשים</h1>
              <p className="header-subtitle">עובדים, קולגות ומנהלים</p>
            </div>
          </div>
          <div className="header-actions">
            <button className="btn btn-outline manager-btn" onClick={() => openAddModal('manager')}>
              <Crown size={18} />
              מנהל חדש
            </button>
            <button className="btn btn-secondary" onClick={() => openAddModal('colleague')}>
              <Users size={18} />
              קולגה חדש
            </button>
            <button className="btn btn-primary" onClick={() => openAddModal('employee')}>
              <Plus size={18} />
              עובד חדש
            </button>
          </div>
        </div>
      </header>
      
      {/* Search & Filter */}
      <div className="search-filter-section">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="חיפוש לפי שם, תפקיד או מחלקה..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch('')}>
              <X size={16} />
            </button>
          )}
        </div>
        
        <div className="filter-tabs">
          <button
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            הכל
            <span className="tab-count">{people.length}</span>
          </button>
          <button
            className={`filter-tab employee ${filter === 'employee' ? 'active' : ''}`}
            onClick={() => setFilter('employee')}
          >
            <Star size={14} />
            עובדים
            <span className="tab-count">{employees.length}</span>
          </button>
          <button
            className={`filter-tab colleague ${filter === 'colleague' ? 'active' : ''}`}
            onClick={() => setFilter('colleague')}
          >
            <Users size={14} />
            קולגות
            <span className="tab-count">{colleagues.length}</span>
          </button>
          <button
            className={`filter-tab manager ${filter === 'manager' ? 'active' : ''}`}
            onClick={() => setFilter('manager')}
          >
            <Crown size={14} />
            מנהלים
            <span className="tab-count">{managers.length}</span>
          </button>
        </div>
      </div>
      
      {/* People Grid */}
      {people.length === 0 ? (
        <div className="empty-people">
          <div className="empty-illustration">
            <UserCircle size={56} />
          </div>
          <h3>אין אנשים עדיין</h3>
          <p>הוסף עובדים וקולגות כדי לנהל פגישות ומשימות</p>
          <div className="empty-actions">
            <button className="btn btn-primary" onClick={() => openAddModal('employee')}>
              <Plus size={18} />
              הוסף עובד
            </button>
            <button className="btn btn-secondary" onClick={() => openAddModal('colleague')}>
              הוסף קולגה
            </button>
          </div>
        </div>
      ) : (
        <div className="people-grid stagger">
          {people.map(person => (
            <div key={person.id} className={`person-card ${person.person_type || 'employee'}`}>
              <div className="person-card-header">
                <div className={`person-avatar ${person.person_type || 'employee'}`}>
                  <span className="avatar-letter">{person.name?.[0] || '?'}</span>
                  {person.person_type === 'manager' && (
                    <span className="avatar-badge manager">
                      <Crown size={10} />
                    </span>
                  )}
                  {(person.person_type === 'employee' || !person.person_type) && (
                    <span className="avatar-badge employee">
                      <Star size={10} />
                    </span>
                  )}
                </div>
                <div className="person-quick-actions">
                  <button className="quick-action" onClick={() => openEditModal(person)} title="ערוך">
                    <Edit size={14} />
                  </button>
                  <button className="quick-action danger" onClick={() => handleDelete(person.id)} title="מחק">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              
              <Link to={`/people/${person.id}`} className="person-info">
                <h3 className="person-name">{person.name}</h3>
                
                {person.role && (
                  <div className="person-detail">
                    <Briefcase size={14} />
                    <span>{person.role}</span>
                  </div>
                )}
                
                {person.department && (
                  <div className="person-detail">
                    <Building2 size={14} />
                    <span>{person.department}</span>
                  </div>
                )}
                
                {person.email && (
                  <div className="person-detail">
                    <Mail size={14} />
                    <span>{person.email}</span>
                  </div>
                )}
              </Link>
              
              <div className="person-footer">
                <span className={`type-badge ${person.person_type || 'employee'}`}>
                  {person.person_type === 'colleague' ? 'קולגה' : person.person_type === 'manager' ? 'מנהל' : 'עובד'}
                </span>
                
                <div className="person-metrics">
                  <div className="metric" title="פגישות">
                    <Calendar size={14} />
                    <span>{person.meeting_count || 0}</span>
                  </div>
                  
                  {person.pending_discussion_topics > 0 && (
                    <div className="metric highlight" title="נושאים לדיון">
                      <MessageSquare size={14} />
                      <span>{person.pending_discussion_topics}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {person.last_meeting_date && (
                <div className="last-meeting-info">
                  פגישה אחרונה: {format(parseISO(person.last_meeting_date), 'd/M/yyyy')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {editingPerson ? (
                  <>
                    <Edit size={20} />
                    עריכת פרטים
                  </>
                ) : formData.person_type === 'colleague' ? (
                  <>
                    <Users size={20} />
                    קולגה חדש
                  </>
                ) : formData.person_type === 'manager' ? (
                  <>
                    <Crown size={20} />
                    מנהל חדש
                  </>
                ) : (
                  <>
                    <Plus size={20} />
                    עובד חדש
                  </>
                )}
              </h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">שם מלא</label>
                <input
                  type="text"
                  className="form-input form-input-lg"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="הכנס שם..."
                  autoFocus
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">סוג</label>
                <div className="type-selector">
                  <button
                    type="button"
                    className={`type-option employee ${formData.person_type === 'employee' ? 'active' : ''}`}
                    onClick={() => setFormData({ ...formData, person_type: 'employee' })}
                  >
                    <Star size={18} />
                    <div className="type-option-content">
                      <span className="type-option-label">עובד</span>
                      <span className="type-option-desc">כפוף אליי</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`type-option colleague ${formData.person_type === 'colleague' ? 'active' : ''}`}
                    onClick={() => setFormData({ ...formData, person_type: 'colleague' })}
                  >
                    <Users size={18} />
                    <div className="type-option-content">
                      <span className="type-option-label">קולגה</span>
                      <span className="type-option-desc">עמית לעבודה</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`type-option manager ${formData.person_type === 'manager' ? 'active' : ''}`}
                    onClick={() => setFormData({ ...formData, person_type: 'manager' })}
                  >
                    <Crown size={18} />
                    <div className="type-option-content">
                      <span className="type-option-label">מנהל</span>
                      <span className="type-option-desc">המנהל שלי</span>
                    </div>
                  </button>
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">תפקיד</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                    placeholder="למשל: מפתח Full Stack"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">מחלקה</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.department}
                    onChange={e => setFormData({ ...formData, department: e.target.value })}
                    placeholder="למשל: R&D"
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">אימייל</label>
                <input
                  type="email"
                  className="form-input"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">הערות</label>
                <textarea
                  className="form-textarea"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="הערות אישיות, מידע חשוב..."
                  rows={3}
                />
              </div>
              
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  ביטול
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingPerson ? 'שמור שינויים' : 'הוסף'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default People
