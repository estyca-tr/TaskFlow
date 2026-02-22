import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { UserProvider, useUser } from './context/UserContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import People from './pages/People'
import EmployeeDetail from './pages/EmployeeDetail'
import NewMeeting from './pages/NewMeeting'
import MeetingDetail from './pages/MeetingDetail'
import Analytics from './pages/Analytics'
import MyTasks from './pages/MyTasks'
import DailyMeetings from './pages/DailyMeetings'
import QuickNotes from './pages/QuickNotes'

// Protected Route component
function ProtectedRoute({ children }) {
  const { user, loading } = useUser()
  
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
      </div>
    )
  }
  
  if (!user) {
    return <Navigate to="/login" replace />
  }
  
  return children
}

// Main app with routes
function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="people" element={<People />} />
        <Route path="people/:id" element={<EmployeeDetail />} />
        <Route path="employees" element={<People />} />
        <Route path="employees/:id" element={<EmployeeDetail />} />
        <Route path="tasks" element={<MyTasks />} />
        <Route path="daily-meetings" element={<DailyMeetings />} />
        <Route path="notes" element={<QuickNotes />} />
        <Route path="meetings/new" element={<NewMeeting />} />
        <Route path="meetings/:id" element={<MeetingDetail />} />
        <Route path="analytics" element={<Analytics />} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <UserProvider>
        <AppRoutes />
      </UserProvider>
    </BrowserRouter>
  )
}

export default App
