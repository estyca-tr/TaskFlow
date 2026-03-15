import { useState, useRef } from 'react'
import { 
  Camera, Upload, X, Loader2, CheckCircle2, 
  AlertCircle, Plus, Sparkles, ImagePlus, Clipboard
} from 'lucide-react'
import { tasksAPI } from '../services/api'

const PRIORITY_LABELS = {
  high: { label: 'גבוהה', emoji: '🔴' },
  medium: { label: 'בינונית', emoji: '🟡' },
  low: { label: 'נמוכה', emoji: '🟢' }
}

function ScreenshotExtractor({ onTasksExtracted, onClose }) {
  const [image, setImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [selectedTasks, setSelectedTasks] = useState([])
  const [context, setContext] = useState('')
  const fileInputRef = useRef(null)

  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (!file.type.startsWith('image/')) {
      setError('אנא בחר קובץ תמונה')
      return
    }
    
    const reader = new FileReader()
    reader.onload = () => {
      setImage(reader.result)
      setImagePreview(reader.result)
      setError(null)
      setResult(null)
    }
    reader.readAsDataURL(file)
  }

  async function handlePaste(e) {
    const items = e.clipboardData?.items
    if (!items) return
    
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        const reader = new FileReader()
        reader.onload = () => {
          setImage(reader.result)
          setImagePreview(reader.result)
          setError(null)
          setResult(null)
        }
        reader.readAsDataURL(file)
        e.preventDefault()
        break
      }
    }
  }

  async function handleExtract() {
    if (!image) {
      setError('אנא העלה תמונה תחילה')
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await tasksAPI.extractFromScreenshot({
        image,
        context: context || null
      })
      
      setResult(response)
      setSelectedTasks(response.tasks.map((_, idx) => idx))
    } catch (err) {
      setError(err.message || 'שגיאה בחילוץ משימות')
    } finally {
      setLoading(false)
    }
  }

  function toggleTaskSelection(idx) {
    setSelectedTasks(prev => 
      prev.includes(idx) 
        ? prev.filter(i => i !== idx)
        : [...prev, idx]
    )
  }

  function handleAddSelectedTasks() {
    if (!result || selectedTasks.length === 0) return
    
    const tasksToAdd = selectedTasks.map(idx => result.tasks[idx])
    onTasksExtracted?.(tasksToAdd)
    onClose?.()
  }

  function handleClear() {
    setImage(null)
    setImagePreview(null)
    setResult(null)
    setSelectedTasks([])
    setError(null)
    setContext('')
  }

  return (
    <div className="screenshot-extractor">
      <div className="se-header">
        <div className="se-header-content">
          <Sparkles size={24} className="se-icon" />
          <div>
            <h2>חילוץ משימות מתמונה</h2>
            <p>העלה צילום מסך של יומן או הערות ישיבה</p>
          </div>
        </div>
        {onClose && (
          <button className="btn btn-ghost" onClick={onClose}>
            <X size={20} />
          </button>
        )}
      </div>

      <div className="se-content">
        {!imagePreview ? (
          <div 
            className="se-upload-zone"
            onClick={() => fileInputRef.current?.click()}
            onPaste={handlePaste}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const file = e.dataTransfer.files?.[0]
              if (file) {
                const input = fileInputRef.current
                const dt = new DataTransfer()
                dt.items.add(file)
                input.files = dt.files
                handleFileSelect({ target: input })
              }
            }}
            tabIndex={0}
          >
            <div className="se-upload-icon">
              <ImagePlus size={48} />
            </div>
            <h3>העלה צילום מסך</h3>
            <p>לחץ לבחירת קובץ, גרור תמונה לכאן, או הדבק מהקליפבורד (Ctrl+V)</p>
            <div className="se-upload-actions">
              <button className="btn btn-primary">
                <Upload size={18} />
                בחר תמונה
              </button>
              <button className="btn btn-secondary" onClick={(e) => {
                e.stopPropagation()
                navigator.clipboard.read().then(items => {
                  for (const item of items) {
                    const imageType = item.types.find(t => t.startsWith('image/'))
                    if (imageType) {
                      item.getType(imageType).then(blob => {
                        const reader = new FileReader()
                        reader.onload = () => {
                          setImage(reader.result)
                          setImagePreview(reader.result)
                        }
                        reader.readAsDataURL(blob)
                      })
                      break
                    }
                  }
                }).catch(() => {})
              }}>
                <Clipboard size={18} />
                הדבק מהקליפבורד
              </button>
            </div>
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              onChange={handleFileSelect}
              className="se-file-input"
            />
          </div>
        ) : (
          <div className="se-preview-section">
            <div className="se-image-preview">
              <img src={imagePreview} alt="Screenshot preview" />
              <button className="se-clear-btn" onClick={handleClear}>
                <X size={16} />
              </button>
            </div>
            
            <div className="se-context-input">
              <label>הקשר נוסף (אופציונלי)</label>
              <input
                type="text"
                placeholder="למשל: ישיבת 1:1 עם דני, פגישת צוות..."
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className="form-input"
              />
            </div>
            
            {!result && (
              <button 
                className="btn btn-primary btn-lg se-extract-btn"
                onClick={handleExtract}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="spin" />
                    מנתח תמונה...
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    חלץ משימות
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="se-error">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {result && (
          <div className="se-results">
            <div className="se-results-header">
              <div>
                <h3>נמצאו {result.total} משימות</h3>
                {result.meeting_title && (
                  <span className="se-meeting-title">{result.meeting_title}</span>
                )}
              </div>
              <span className="se-selected-count">
                {selectedTasks.length} נבחרו
              </span>
            </div>
            
            {result.summary && (
              <div className="se-summary">
                <Sparkles size={14} />
                {result.summary}
              </div>
            )}

            <div className="se-tasks-list">
              {result.tasks.map((task, idx) => (
                <div 
                  key={idx}
                  className={`se-task-item ${selectedTasks.includes(idx) ? 'selected' : ''}`}
                  onClick={() => toggleTaskSelection(idx)}
                >
                  <div className="se-task-checkbox">
                    {selectedTasks.includes(idx) ? (
                      <CheckCircle2 size={20} className="checked" />
                    ) : (
                      <div className="unchecked" />
                    )}
                  </div>
                  <div className="se-task-content">
                    <span className="se-task-title">{task.title}</span>
                    {task.description && (
                      <span className="se-task-desc">{task.description}</span>
                    )}
                    <div className="se-task-meta">
                      <span className={`se-priority ${task.priority}`}>
                        {PRIORITY_LABELS[task.priority]?.emoji} {PRIORITY_LABELS[task.priority]?.label}
                      </span>
                      {task.person_name && (
                        <span className="se-person">👤 {task.person_name}</span>
                      )}
                      {task.due_date && (
                        <span className="se-due">📅 {task.due_date}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="se-actions">
              <button className="btn btn-secondary" onClick={handleClear}>
                נקה והתחל מחדש
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleAddSelectedTasks}
                disabled={selectedTasks.length === 0}
              >
                <Plus size={18} />
                הוסף {selectedTasks.length} משימות
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .screenshot-extractor {
          background: var(--bg-card);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-color);
          overflow: hidden;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
        }

        .se-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-lg);
          border-bottom: 1px solid var(--border-color);
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%);
        }

        .se-header-content {
          display: flex;
          align-items: center;
          gap: var(--space-md);
        }

        .se-icon {
          color: var(--accent-purple);
        }

        .se-header h2 {
          font-size: 1.25rem;
          margin: 0;
        }

        .se-header p {
          margin: 0;
          font-size: 0.875rem;
          color: var(--text-muted);
        }

        .se-content {
          padding: var(--space-lg);
          overflow-y: auto;
          flex: 1;
        }

        .se-upload-zone {
          border: 2px dashed var(--border-color);
          border-radius: var(--radius-lg);
          padding: var(--space-xl);
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
          background: var(--bg-secondary);
        }

        .se-upload-zone:hover,
        .se-upload-zone:focus {
          border-color: var(--accent-purple);
          background: rgba(139, 92, 246, 0.05);
        }

        .se-upload-icon {
          color: var(--text-muted);
          margin-bottom: var(--space-md);
        }

        .se-upload-zone h3 {
          margin: 0 0 var(--space-sm);
          font-size: 1.1rem;
        }

        .se-upload-zone p {
          color: var(--text-muted);
          font-size: 0.875rem;
          margin-bottom: var(--space-lg);
        }

        .se-upload-actions {
          display: flex;
          gap: var(--space-sm);
          justify-content: center;
        }

        .se-file-input {
          display: none;
        }

        .se-preview-section {
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
        }

        .se-image-preview {
          position: relative;
          border-radius: var(--radius-md);
          overflow: hidden;
          max-height: 300px;
        }

        .se-image-preview img {
          width: 100%;
          height: auto;
          max-height: 300px;
          object-fit: contain;
          background: var(--bg-secondary);
        }

        .se-clear-btn {
          position: absolute;
          top: var(--space-sm);
          right: var(--space-sm);
          background: rgba(0, 0, 0, 0.7);
          border: none;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          cursor: pointer;
          transition: all 0.2s;
        }

        .se-clear-btn:hover {
          background: rgba(239, 68, 68, 0.9);
        }

        .se-context-input label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          margin-bottom: var(--space-xs);
        }

        .se-extract-btn {
          width: 100%;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .se-error {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          padding: var(--space-md);
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: var(--radius-md);
          color: #ef4444;
          margin-top: var(--space-md);
        }

        .se-results {
          margin-top: var(--space-lg);
        }

        .se-results-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-md);
        }

        .se-results-header h3 {
          margin: 0;
          font-size: 1rem;
        }

        .se-meeting-title {
          font-size: 0.875rem;
          color: var(--text-muted);
        }

        .se-selected-count {
          background: var(--accent-purple);
          color: white;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .se-summary {
          display: flex;
          align-items: flex-start;
          gap: var(--space-sm);
          padding: var(--space-md);
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%);
          border-radius: var(--radius-md);
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin-bottom: var(--space-md);
        }

        .se-tasks-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-sm);
          max-height: 300px;
          overflow-y: auto;
        }

        .se-task-item {
          display: flex;
          align-items: flex-start;
          gap: var(--space-md);
          padding: var(--space-md);
          background: var(--bg-secondary);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.2s;
          border: 2px solid transparent;
        }

        .se-task-item:hover {
          background: var(--bg-hover);
        }

        .se-task-item.selected {
          border-color: var(--accent-purple);
          background: rgba(139, 92, 246, 0.1);
        }

        .se-task-checkbox {
          flex-shrink: 0;
          padding-top: 2px;
        }

        .se-task-checkbox .checked {
          color: var(--accent-purple);
        }

        .se-task-checkbox .unchecked {
          width: 20px;
          height: 20px;
          border: 2px solid var(--border-color);
          border-radius: 50%;
        }

        .se-task-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .se-task-title {
          font-weight: 500;
        }

        .se-task-desc {
          font-size: 0.875rem;
          color: var(--text-muted);
        }

        .se-task-meta {
          display: flex;
          gap: var(--space-sm);
          flex-wrap: wrap;
          margin-top: 4px;
        }

        .se-task-meta span {
          font-size: 0.75rem;
          padding: 2px 8px;
          border-radius: 10px;
          background: var(--bg-primary);
        }

        .se-priority.high {
          color: #ef4444;
        }

        .se-priority.medium {
          color: #f59e0b;
        }

        .se-priority.low {
          color: #10b981;
        }

        .se-actions {
          display: flex;
          gap: var(--space-sm);
          justify-content: flex-end;
          margin-top: var(--space-lg);
          padding-top: var(--space-lg);
          border-top: 1px solid var(--border-color);
        }

        .btn-lg {
          padding: var(--space-md) var(--space-lg);
          font-size: 1rem;
        }
      `}</style>
    </div>
  )
}

export default ScreenshotExtractor
