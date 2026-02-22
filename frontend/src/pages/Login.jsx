import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, ArrowLeft, Sparkles } from 'lucide-react'
import { useUser } from '../context/UserContext'
import { usersAPI } from '../services/api'
import './Login.css'

function Login() {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useUser()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!username.trim()) {
      setError('אנא הכנס/י שם משתמש')
      return
    }

    setLoading(true)
    setError('')

    try {
      const userData = await usersAPI.login(username.trim())
      login(userData)
      
      // Migrate existing data if this is the first login (user "אסתי")
      if (userData.username === 'אסתי' || userData.username === 'esty') {
        try {
          await usersAPI.migrateData(userData.id)
        } catch (e) {
          console.log('Migration already done or no data to migrate')
        }
      }
      
      navigate('/')
    } catch (err) {
      setError('שגיאה בכניסה, נסה/י שוב')
      console.error('Login error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-background">
        <div className="bg-gradient"></div>
        <div className="bg-pattern"></div>
      </div>
      
      <div className="login-container">
        <div className="login-card animate-scale-in">
          <div className="login-header">
            <div className="login-logo">
              <Sparkles size={32} />
            </div>
            <h1>TaskFlow</h1>
            <p>ניהול משימות ופגישות</p>
          </div>
          
          <form onSubmit={handleSubmit} className="login-form">
            <div className="input-group">
              <label htmlFor="username">שם משתמש</label>
              <div className="input-wrapper">
                <User size={20} />
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="הכנס/י את שמך..."
                  autoFocus
                  disabled={loading}
                />
              </div>
            </div>
            
            {error && (
              <div className="login-error">
                {error}
              </div>
            )}
            
            <button 
              type="submit" 
              className="login-btn"
              disabled={loading || !username.trim()}
            >
              {loading ? (
                <span className="loading-spinner"></span>
              ) : (
                <>
                  <span>כניסה</span>
                  <ArrowLeft size={18} />
                </>
              )}
            </button>
          </form>
          
          <div className="login-footer">
            <p>אין צורך בסיסמה - רק שם משתמש</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login

