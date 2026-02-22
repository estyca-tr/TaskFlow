import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Lock, ArrowLeft, Sparkles, UserPlus } from 'lucide-react'
import { useUser } from '../context/UserContext'
import { usersAPI } from '../services/api'
import './Login.css'

function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)
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

    if (!password) {
      setError('אנא הכנס/י סיסמה')
      return
    }

    if (isRegister && password.length < 4) {
      setError('הסיסמה חייבת להכיל לפחות 4 תווים')
      return
    }

    setLoading(true)
    setError('')

    try {
      let userData
      if (isRegister) {
        userData = await usersAPI.register(username.trim(), password)
      } else {
        userData = await usersAPI.login(username.trim(), password)
      }
      login(userData)
      navigate('/')
    } catch (err) {
      setError(err.message || 'שגיאה בהתחברות')
      console.error('Login error:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = () => {
    setIsRegister(!isRegister)
    setError('')
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
          
          <div className="login-mode-toggle">
            <button 
              className={`mode-btn ${!isRegister ? 'active' : ''}`}
              onClick={() => { setIsRegister(false); setError('') }}
              type="button"
            >
              כניסה
            </button>
            <button 
              className={`mode-btn ${isRegister ? 'active' : ''}`}
              onClick={() => { setIsRegister(true); setError('') }}
              type="button"
            >
              הרשמה
            </button>
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
            
            <div className="input-group">
              <label htmlFor="password">סיסמה</label>
              <div className="input-wrapper">
                <Lock size={20} />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isRegister ? "בחר/י סיסמה (לפחות 4 תווים)" : "הכנס/י סיסמה..."}
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
              disabled={loading || !username.trim() || !password}
            >
              {loading ? (
                <span className="loading-spinner"></span>
              ) : (
                <>
                  <span>{isRegister ? 'הרשמה' : 'כניסה'}</span>
                  {isRegister ? <UserPlus size={18} /> : <ArrowLeft size={18} />}
                </>
              )}
            </button>
          </form>
          
          <div className="login-footer">
            <p>
              {isRegister 
                ? 'כבר יש לך חשבון?' 
                : 'עוד אין לך חשבון?'}
              <button onClick={toggleMode} className="toggle-link">
                {isRegister ? 'התחבר/י' : 'הירשם/י'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login

