import { useState, useEffect } from 'react'
import { 
  StickyNote, Plus, X, Search, Pin, PinOff, Edit3, Trash2,
  Link, User, Key, Code, FileText, Filter
} from 'lucide-react'
import { quickNotesAPI, employeesAPI } from '../services/api'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import './QuickNotes.css'

const CATEGORIES = [
  { value: 'general', label: 'כללי', icon: FileText, color: 'var(--text-secondary)' },
  { value: 'link', label: 'קישור', icon: Link, color: '#3b82f6' },
  { value: 'credential', label: 'פרטי גישה', icon: Key, color: '#f59e0b' },
  { value: 'contact', label: 'איש קשר', icon: User, color: '#10b981' },
  { value: 'snippet', label: 'קטע קוד', icon: Code, color: '#8b5cf6' },
]

function QuickNotes() {
  const [notes, setNotes] = useState([])
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingNote, setEditingNote] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'general',
    person_id: '',
    is_pinned: false
  })

  useEffect(() => {
    loadNotes()
    loadPeople()
  }, [filterCategory, searchTerm])

  async function loadNotes() {
    try {
      setLoading(true)
      const params = {}
      if (filterCategory) params.category = filterCategory
      if (searchTerm) params.search = searchTerm
      const data = await quickNotesAPI.getAll(params)
      setNotes(data.notes || [])
    } catch (err) {
      console.error('Error loading notes:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadPeople() {
    try {
      const data = await employeesAPI.getAll()
      setPeople(data.employees || [])
    } catch (err) {
      console.error('Error loading people:', err)
    }
  }

  function openAddModal() {
    setFormData({
      title: '',
      content: '',
      category: 'general',
      person_id: '',
      is_pinned: false
    })
    setEditingNote(null)
    setShowAddModal(true)
  }

  function openEditModal(note) {
    setFormData({
      title: note.title,
      content: note.content,
      category: note.category,
      person_id: note.person_id || '',
      is_pinned: note.is_pinned
    })
    setEditingNote(note)
    setShowAddModal(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      const data = {
        ...formData,
        person_id: formData.person_id ? parseInt(formData.person_id) : null
      }
      
      if (editingNote) {
        await quickNotesAPI.update(editingNote.id, data)
      } else {
        await quickNotesAPI.create(data)
      }
      
      setShowAddModal(false)
      loadNotes()
    } catch (err) {
      console.error('Error saving note:', err)
    }
  }

  async function handleTogglePin(note) {
    try {
      await quickNotesAPI.togglePin(note.id)
      loadNotes()
    } catch (err) {
      console.error('Error toggling pin:', err)
    }
  }

  async function handleDelete(note) {
    if (!confirm('האם למחוק את הפתק?')) return
    try {
      await quickNotesAPI.delete(note.id)
      loadNotes()
    } catch (err) {
      console.error('Error deleting note:', err)
    }
  }

  function getCategoryInfo(category) {
    return CATEGORIES.find(c => c.value === category) || CATEGORIES[0]
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
    // Could add a toast notification here
  }

  return (
    <div className="quick-notes-page">
      <div className="page-header">
        <div className="header-content">
          <div className="header-title">
            <StickyNote size={28} />
            <div>
              <h1>פתקים מהירים</h1>
              <p className="subtitle">שמור מידע חשוב - קישורים, פרטי גישה, ועוד</p>
            </div>
          </div>
          <button className="btn btn-primary" onClick={openAddModal}>
            <Plus size={18} />
            פתק חדש
          </button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="notes-toolbar">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="חיפוש בפתקים..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="filter-buttons">
          <button 
            className={`filter-btn ${filterCategory === '' ? 'active' : ''}`}
            onClick={() => setFilterCategory('')}
          >
            הכל
          </button>
          {CATEGORIES.map(cat => {
            const Icon = cat.icon
            return (
              <button 
                key={cat.value}
                className={`filter-btn ${filterCategory === cat.value ? 'active' : ''}`}
                onClick={() => setFilterCategory(cat.value)}
                style={{ '--cat-color': cat.color }}
              >
                <Icon size={14} />
                {cat.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Notes Grid */}
      <div className="notes-container">
        {loading ? (
          <div className="loading-state">
            <div className="loader"></div>
            <p>טוען פתקים...</p>
          </div>
        ) : notes.length === 0 ? (
          <div className="empty-state">
            <StickyNote size={64} />
            <h3>אין פתקים עדיין</h3>
            <p>צור פתק חדש לשמירת מידע חשוב</p>
            <button className="btn btn-primary" onClick={openAddModal}>
              <Plus size={18} />
              פתק חדש
            </button>
          </div>
        ) : (
          <div className="notes-grid">
            {notes.map(note => {
              const catInfo = getCategoryInfo(note.category)
              const Icon = catInfo.icon
              
              return (
                <div 
                  key={note.id} 
                  className={`note-card ${note.is_pinned ? 'pinned' : ''}`}
                  style={{ '--cat-color': catInfo.color }}
                >
                  <div className="note-header">
                    <div className="note-category">
                      <Icon size={14} />
                      <span>{catInfo.label}</span>
                    </div>
                    <div className="note-actions">
                      <button 
                        className={`action-btn pin-btn ${note.is_pinned ? 'active' : ''}`}
                        onClick={() => handleTogglePin(note)}
                        title={note.is_pinned ? 'בטל הצמדה' : 'הצמד'}
                      >
                        {note.is_pinned ? <PinOff size={14} /> : <Pin size={14} />}
                      </button>
                      <button 
                        className="action-btn"
                        onClick={() => openEditModal(note)}
                        title="ערוך"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button 
                        className="action-btn delete-btn"
                        onClick={() => handleDelete(note)}
                        title="מחק"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  
                  <h3 className="note-title">{note.title}</h3>
                  
                  <div 
                    className="note-content"
                    onClick={() => copyToClipboard(note.content)}
                    title="לחץ להעתקה"
                  >
                    {note.content}
                  </div>
                  
                  <div className="note-footer">
                    {note.person_name && (
                      <span className="note-person">
                        <User size={12} />
                        {note.person_name}
                      </span>
                    )}
                    <span className="note-date">
                      {format(new Date(note.updated_at), 'd בMMM', { locale: he })}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <StickyNote size={20} />
                {editingNote ? 'עריכת פתק' : 'פתק חדש'}
              </h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">כותרת</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="למשל: Jenkins Production"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">תוכן</label>
                <textarea
                  className="form-input form-textarea"
                  placeholder="הקלד את המידע שברצונך לשמור..."
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  required
                  rows={4}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">קטגוריה</label>
                <div className="category-selector">
                  {CATEGORIES.map(cat => {
                    const Icon = cat.icon
                    return (
                      <button
                        key={cat.value}
                        type="button"
                        className={`category-btn ${formData.category === cat.value ? 'active' : ''}`}
                        onClick={() => setFormData({ ...formData, category: cat.value })}
                        style={{ '--cat-color': cat.color }}
                      >
                        <Icon size={16} />
                        {cat.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">קשור לאדם (אופציונלי)</label>
                <select
                  className="form-input"
                  value={formData.person_id}
                  onChange={(e) => setFormData({ ...formData, person_id: e.target.value })}
                >
                  <option value="">-- ללא --</option>
                  {people.map(person => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.is_pinned}
                    onChange={(e) => setFormData({ ...formData, is_pinned: e.target.checked })}
                  />
                  <Pin size={14} />
                  הצמד למעלה
                </label>
              </div>
              
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  ביטול
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingNote ? 'שמור שינויים' : 'צור פתק'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default QuickNotes

