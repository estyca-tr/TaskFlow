import { useState, useEffect, useRef } from 'react'
import { 
  Calendar, Clock, MapPin, Users, Plus, X, Check, 
  ChevronRight, ChevronLeft, Sparkles, Edit3, Trash2,
  MessageSquare, AlertCircle, CheckCircle2, Image, Upload, Loader
} from 'lucide-react'
import { calendarAPI } from '../services/api'
import { format, parseISO, addDays, subDays, isToday, isTomorrow, isYesterday, isSameDay, startOfWeek } from 'date-fns'
import { he } from 'date-fns/locale'
import './DailyMeetings.css'

function DailyMeetings() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddMeeting, setShowAddMeeting] = useState(false)
  const [expandedMeeting, setExpandedMeeting] = useState(null)
  const [newNote, setNewNote] = useState('')
  const [weekMeetingCounts, setWeekMeetingCounts] = useState({})
  
  // Screenshot upload state
  const [showScreenshotModal, setShowScreenshotModal] = useState(false)
  const [screenshotImage, setScreenshotImage] = useState(null)
  const [extractedMeetings, setExtractedMeetings] = useState([])
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState(null)
  const fileInputRef = useRef(null)
  
  const [newMeeting, setNewMeeting] = useState({
    title: '',
    start_time: '',
    end_time: '',
    location: '',
    attendees: ''
  })

  // Generate week days array (today + 6 days)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i))

  useEffect(() => {
    loadMeetings()
  }, [selectedDate])

  useEffect(() => {
    loadWeekCounts()
  }, [])

  async function loadMeetings() {
    try {
      setLoading(true)
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const data = await calendarAPI.getByDate(dateStr)
      setMeetings(data.meetings || [])
      // Update count for this date
      setWeekMeetingCounts(prev => ({
        ...prev,
        [dateStr]: (data.meetings || []).length
      }))
    } catch (err) {
      console.error('Error loading meetings:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadWeekCounts() {
    // Load meeting counts for each day of the week
    const counts = {}
    for (const day of weekDays) {
      try {
        const dateStr = format(day, 'yyyy-MM-dd')
        const data = await calendarAPI.getByDate(dateStr)
        counts[dateStr] = (data.meetings || []).length
      } catch (err) {
        console.error('Error loading count for', day)
      }
    }
    setWeekMeetingCounts(counts)
  }

  async function handleCreateMeeting(e) {
    e.preventDefault()
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const meetingData = {
        title: newMeeting.title,
        start_time: `${dateStr}T${newMeeting.start_time}:00`,
        end_time: `${dateStr}T${newMeeting.end_time}:00`,
        location: newMeeting.location || null,
        attendees: newMeeting.attendees || null,
        calendar_source: 'manual'
      }
      
      await calendarAPI.create(meetingData)
      setShowAddMeeting(false)
      setNewMeeting({ title: '', start_time: '', end_time: '', location: '', attendees: '' })
      loadMeetings()
    } catch (err) {
      console.error('Error creating meeting:', err)
    }
  }

  async function handleAddNote(meetingId) {
    if (!newNote.trim()) return
    try {
      await calendarAPI.addNote(meetingId, { content: newNote.trim() })
      setNewNote('')
      loadMeetings()
    } catch (err) {
      console.error('Error adding note:', err)
    }
  }

  async function handleToggleNote(meetingId, noteId) {
    try {
      await calendarAPI.toggleNote(meetingId, noteId)
      loadMeetings()
    } catch (err) {
      console.error('Error toggling note:', err)
    }
  }

  async function handleDeleteNote(meetingId, noteId) {
    try {
      await calendarAPI.deleteNote(meetingId, noteId)
      loadMeetings()
    } catch (err) {
      console.error('Error deleting note:', err)
    }
  }

  async function handleDeleteMeeting(meetingId) {
    if (!confirm('האם למחוק את הישיבה?')) return
    try {
      await calendarAPI.delete(meetingId)
      loadMeetings()
    } catch (err) {
      console.error('Error deleting meeting:', err)
    }
  }

  // Screenshot handling functions
  function handleFileSelect(e) {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setScreenshotImage(event.target.result)
        setExtractedMeetings([])
        setExtractError(null)
      }
      reader.readAsDataURL(file)
    }
  }

  function handlePaste(e) {
    const items = e.clipboardData?.items
    if (!items) return

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        const reader = new FileReader()
        reader.onload = (event) => {
          setScreenshotImage(event.target.result)
          setExtractedMeetings([])
          setExtractError(null)
        }
        reader.readAsDataURL(file)
        break
      }
    }
  }

  async function handleExtractMeetings() {
    if (!screenshotImage) return
    
    setExtracting(true)
    setExtractError(null)
    
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const response = await calendarAPI.extractFromScreenshot({
        image: screenshotImage,
        target_date: dateStr
      })
      setExtractedMeetings(response.meetings || [])
    } catch (err) {
      console.error('Error extracting meetings:', err)
      setExtractError('לא הצלחתי לזהות ישיבות בתמונה. נסי שוב או הוסיפי ידנית.')
    } finally {
      setExtracting(false)
    }
  }

  async function handleAddExtractedMeetings() {
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      for (const meeting of extractedMeetings) {
        await calendarAPI.create({
          title: meeting.title,
          start_time: `${dateStr}T${meeting.start_time}:00`,
          end_time: `${dateStr}T${meeting.end_time}:00`,
          location: meeting.location || null,
          attendees: meeting.attendees || null,
          calendar_source: 'screenshot'
        })
      }
      setShowScreenshotModal(false)
      setScreenshotImage(null)
      setExtractedMeetings([])
      loadMeetings()
    } catch (err) {
      console.error('Error adding meetings:', err)
    }
  }

  function removeExtractedMeeting(index) {
    setExtractedMeetings(prev => prev.filter((_, i) => i !== index))
  }

  function getDateLabel(date) {
    if (isToday(date)) return 'היום'
    if (isTomorrow(date)) return 'מחר'
    if (isYesterday(date)) return 'אתמול'
    return format(date, 'EEEE', { locale: he })
  }

  function getMeetingDuration(start, end) {
    const startDate = parseISO(start)
    const endDate = parseISO(end)
    const minutes = (endDate - startDate) / 1000 / 60
    if (minutes < 60) return `${minutes} דקות`
    const hours = Math.floor(minutes / 60)
    const remainingMins = minutes % 60
    if (remainingMins === 0) return `${hours} שעות`
    return `${hours}:${remainingMins.toString().padStart(2, '0')} שעות`
  }

  return (
    <div className="daily-meetings-page">
      <div className="page-header">
        <div className="header-content">
          <div className="header-title">
            <Calendar size={28} />
            <div>
              <h1>הכנה לישיבות</h1>
              <p className="subtitle">נהל את הנקודות החשובות לך לכל ישיבה</p>
            </div>
          </div>
          <div className="header-actions">
            <button className="btn btn-secondary" onClick={() => setShowScreenshotModal(true)}>
              <Image size={18} />
              ייבוא מצילום מסך
            </button>
            <button className="btn btn-primary" onClick={() => setShowAddMeeting(true)}>
              <Plus size={18} />
              הוסף ישיבה
            </button>
          </div>
        </div>
      </div>

      {/* Week Strip */}
      <div className="week-strip">
        <div className="week-days">
          {weekDays.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const count = weekMeetingCounts[dateStr] || 0
            const isSelected = isSameDay(day, selectedDate)
            const dayIsToday = isToday(day)
            
            return (
              <button
                key={dateStr}
                className={`week-day ${isSelected ? 'selected' : ''} ${dayIsToday ? 'today' : ''}`}
                onClick={() => setSelectedDate(day)}
              >
                <span className="week-day-name">{format(day, 'EEE', { locale: he })}</span>
                <span className="week-day-number">{format(day, 'd')}</span>
                {count > 0 && <span className="week-day-count">{count}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Date Navigation */}
      <div className="date-navigation">
        <button className="nav-btn" onClick={() => setSelectedDate(subDays(selectedDate, 1))}>
          <ChevronRight size={24} />
        </button>
        <div className="current-date">
          <span className="date-label">{getDateLabel(selectedDate)}</span>
          <span className="date-full">{format(selectedDate, 'd בMMMM yyyy', { locale: he })}</span>
        </div>
        <button className="nav-btn" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
          <ChevronLeft size={24} />
        </button>
        {!isToday(selectedDate) && (
          <button className="today-btn" onClick={() => setSelectedDate(new Date())}>
            חזור להיום
          </button>
        )}
      </div>

      {/* Meetings List */}
      <div className="meetings-container">
        {loading ? (
          <div className="loading-state">
            <div className="loader"></div>
            <p>טוען ישיבות...</p>
          </div>
        ) : meetings.length === 0 ? (
          <div className="empty-state">
            <Calendar size={64} />
            <h3>אין ישיבות ל{getDateLabel(selectedDate)}</h3>
            <p>הוסף ישיבה ידנית או חבר את Google Calendar</p>
            <button className="btn btn-primary" onClick={() => setShowAddMeeting(true)}>
              <Plus size={18} />
              הוסף ישיבה
            </button>
          </div>
        ) : (
          <div className="meetings-timeline">
            {meetings.map(meeting => (
              <div 
                key={meeting.id} 
                className={`meeting-card ${expandedMeeting === meeting.id ? 'expanded' : ''}`}
              >
                <div 
                  className="meeting-header"
                  onClick={() => setExpandedMeeting(expandedMeeting === meeting.id ? null : meeting.id)}
                >
                  <div className="meeting-time">
                    <Clock size={16} />
                    <span>{format(parseISO(meeting.start_time), 'HH:mm')}</span>
                    <span className="time-separator">-</span>
                    <span>{format(parseISO(meeting.end_time), 'HH:mm')}</span>
                  </div>
                  <div className="meeting-info">
                    <h3 className="meeting-title">{meeting.title}</h3>
                    <div className="meeting-meta">
                      {meeting.location && (
                        <span className="meta-item">
                          <MapPin size={14} />
                          {meeting.location}
                        </span>
                      )}
                      {meeting.attendees && (
                        <span className="meta-item">
                          <Users size={14} />
                          {meeting.attendees}
                        </span>
                      )}
                      <span className="meta-item duration">
                        {getMeetingDuration(meeting.start_time, meeting.end_time)}
                      </span>
                    </div>
                  </div>
                  <div className="meeting-stats">
                    {meeting.prep_notes?.length > 0 && (
                      <span className="notes-count">
                        <MessageSquare size={14} />
                        {meeting.prep_notes.filter(n => !n.is_completed).length}/{meeting.prep_notes.length}
                      </span>
                    )}
                    <button 
                      className="delete-meeting-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteMeeting(meeting.id)
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {expandedMeeting === meeting.id && (
                  <div className="meeting-details">
                    <div className="prep-notes-section">
                      <div className="section-header">
                        <Sparkles size={18} />
                        <h4>נקודות להכנה</h4>
                      </div>
                      
                      {meeting.prep_notes?.length > 0 ? (
                        <div className="notes-list">
                          {meeting.prep_notes.map(note => (
                            <div 
                              key={note.id} 
                              className={`prep-note ${note.is_completed ? 'completed' : ''}`}
                            >
                              <button 
                                className="note-checkbox"
                                onClick={() => handleToggleNote(meeting.id, note.id)}
                              >
                                {note.is_completed ? (
                                  <CheckCircle2 size={20} />
                                ) : (
                                  <div className="checkbox-empty" />
                                )}
                              </button>
                              <span className="note-content">{note.content}</span>
                              <button 
                                className="delete-note-btn"
                                onClick={() => handleDeleteNote(meeting.id, note.id)}
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="no-notes">עדיין אין נקודות להכנה</p>
                      )}
                      
                      <div className="add-note-form">
                        <input
                          type="text"
                          placeholder="הוסף נקודה חדשה..."
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleAddNote(meeting.id)
                            }
                          }}
                        />
                        <button 
                          className="add-note-btn"
                          onClick={() => handleAddNote(meeting.id)}
                          disabled={!newNote.trim()}
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Meeting Modal */}
      {showAddMeeting && (
        <div className="modal-overlay" onClick={() => setShowAddMeeting(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <Plus size={20} />
                ישיבה חדשה
              </h2>
              <button className="modal-close" onClick={() => setShowAddMeeting(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateMeeting}>
              <div className="form-group">
                <label className="form-label">כותרת הישיבה</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="לדוגמה: ישיבת צוות שבועית"
                  value={newMeeting.title}
                  onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
                  required
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">שעת התחלה</label>
                  <input
                    type="time"
                    className="form-input"
                    value={newMeeting.start_time}
                    onChange={(e) => setNewMeeting({ ...newMeeting, start_time: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">שעת סיום</label>
                  <input
                    type="time"
                    className="form-input"
                    value={newMeeting.end_time}
                    onChange={(e) => setNewMeeting({ ...newMeeting, end_time: e.target.value })}
                    required
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">מיקום (אופציונלי)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="חדר ישיבות, Zoom, וכו׳"
                  value={newMeeting.location}
                  onChange={(e) => setNewMeeting({ ...newMeeting, location: e.target.value })}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">משתתפים (אופציונלי)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="שמות או אימיילים מופרדים בפסיקים"
                  value={newMeeting.attendees}
                  onChange={(e) => setNewMeeting({ ...newMeeting, attendees: e.target.value })}
                />
              </div>
              
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddMeeting(false)}>
                  ביטול
                </button>
                <button type="submit" className="btn btn-primary">
                  <Plus size={18} />
                  צור ישיבה
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Screenshot Upload Modal */}
      {showScreenshotModal && (
        <div className="modal-overlay" onClick={() => setShowScreenshotModal(false)}>
          <div className="modal screenshot-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <Image size={20} />
                ייבוא ישיבות מצילום מסך
              </h2>
              <button className="modal-close" onClick={() => setShowScreenshotModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="screenshot-content" onPaste={handlePaste}>
              {!screenshotImage ? (
                <div 
                  className="upload-area"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={48} />
                  <h3>העלה צילום מסך מהקאלנדר</h3>
                  <p>גרור תמונה לכאן, הדבק (Ctrl+V) או לחץ לבחירת קובץ</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                </div>
              ) : (
                <div className="screenshot-preview">
                  <img src={screenshotImage} alt="Screenshot" />
                  <button 
                    className="change-image-btn"
                    onClick={() => {
                      setScreenshotImage(null)
                      setExtractedMeetings([])
                    }}
                  >
                    <X size={16} />
                    שנה תמונה
                  </button>
                </div>
              )}

              {screenshotImage && !extracting && extractedMeetings.length === 0 && (
                <button className="btn btn-primary extract-btn" onClick={handleExtractMeetings}>
                  <Sparkles size={18} />
                  זהה ישיבות מהתמונה
                </button>
              )}

              {extracting && (
                <div className="extracting-state">
                  <Loader size={24} className="spin" />
                  <p>מזהה ישיבות מהתמונה...</p>
                </div>
              )}

              {extractError && (
                <div className="extract-error">
                  <AlertCircle size={20} />
                  <p>{extractError}</p>
                </div>
              )}

              {extractedMeetings.length > 0 && (
                <div className="extracted-meetings">
                  <h4>ישיבות שזוהו ({extractedMeetings.length})</h4>
                  <div className="extracted-list">
                    {extractedMeetings.map((meeting, index) => (
                      <div key={index} className="extracted-meeting-item">
                        <div className="extracted-meeting-info">
                          <span className="extracted-time">
                            {meeting.start_time} - {meeting.end_time}
                          </span>
                          <span className="extracted-title">{meeting.title}</span>
                          {meeting.attendees && (
                            <span className="extracted-attendees">
                              <Users size={12} />
                              {meeting.attendees}
                            </span>
                          )}
                        </div>
                        <button 
                          className="remove-extracted-btn"
                          onClick={() => removeExtractedMeeting(index)}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button className="btn btn-primary" onClick={handleAddExtractedMeetings}>
                    <Plus size={18} />
                    הוסף {extractedMeetings.length} ישיבות
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DailyMeetings




