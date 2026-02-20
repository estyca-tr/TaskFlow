import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import People from './pages/People'
import EmployeeDetail from './pages/EmployeeDetail'
import NewMeeting from './pages/NewMeeting'
import MeetingDetail from './pages/MeetingDetail'
import Analytics from './pages/Analytics'
import MyTasks from './pages/MyTasks'
import DailyMeetings from './pages/DailyMeetings'
import QuickNotes from './pages/QuickNotes'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
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
    </BrowserRouter>
  )
}

export default App
