const API_BASE = '/api'

async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  }
  
  const response = await fetch(url, config)
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }
  
  if (response.status === 204) {
    return null
  }
  
  return response.json()
}

// Employees
export const employeesAPI = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return fetchAPI(`/employees${query ? `?${query}` : ''}`)
  },
  
  getById: (id) => fetchAPI(`/employees/${id}`),
  
  create: (data) => fetchAPI('/employees', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  
  update: (id, data) => fetchAPI(`/employees/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  
  delete: (id) => fetchAPI(`/employees/${id}`, {
    method: 'DELETE'
  })
}

// Meetings
export const meetingsAPI = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return fetchAPI(`/meetings${query ? `?${query}` : ''}`)
  },
  
  getById: (id) => fetchAPI(`/meetings/${id}`),
  
  create: (data) => fetchAPI('/meetings', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  
  update: (id, data) => fetchAPI(`/meetings/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  
  delete: (id) => fetchAPI(`/meetings/${id}`, {
    method: 'DELETE'
  }),
  
  addActionItem: (meetingId, data) => fetchAPI(`/meetings/${meetingId}/action-items`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  
  updateActionItem: (itemId, data) => fetchAPI(`/meetings/action-items/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  
  addTopic: (meetingId, data) => fetchAPI(`/meetings/${meetingId}/topics`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  
  extractTasks: (meetingId) => fetchAPI(`/meetings/${meetingId}/extract-tasks`, {
    method: 'POST'
  })
}

// Tasks
export const tasksAPI = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return fetchAPI(`/tasks${query ? `?${query}` : ''}`)
  },
  
  getMy: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return fetchAPI(`/tasks/my${query ? `?${query}` : ''}`)
  },
  
  getDiscussTopics: (personId, includeCompleted = false) => {
    return fetchAPI(`/tasks/discuss/${personId}?include_completed=${includeCompleted}`)
  },
  
  getToday: () => fetchAPI('/tasks/today'),
  
  getById: (id) => fetchAPI(`/tasks/${id}`),
  
  create: (data) => fetchAPI('/tasks', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  
  createBulk: (tasks) => fetchAPI('/tasks/bulk', {
    method: 'POST',
    body: JSON.stringify(tasks)
  }),
  
  update: (id, data) => fetchAPI(`/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  
  complete: (id) => fetchAPI(`/tasks/${id}/complete`, {
    method: 'POST'
  }),
  
  delete: (id) => fetchAPI(`/tasks/${id}`, {
    method: 'DELETE'
  })
}

// Analytics
export const analyticsAPI = {
  getOverview: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return fetchAPI(`/analytics/overview${query ? `?${query}` : ''}`)
  },
  
  getEmployeeAnalytics: (employeeId, params = {}) => {
    const query = new URLSearchParams(params).toString()
    return fetchAPI(`/analytics/employee/${employeeId}${query ? `?${query}` : ''}`)
  },
  
  getPendingActionItems: (employeeId) => {
    const query = employeeId ? `?employee_id=${employeeId}` : ''
    return fetchAPI(`/analytics/action-items/pending${query}`)
  },
  
  getTopicTrends: (months = 6) => fetchAPI(`/analytics/topics/trends?months=${months}`),
  
  analyzeMeeting: (meetingId, notes) => fetchAPI('/analytics/analyze', {
    method: 'POST',
    body: JSON.stringify({ meeting_id: meetingId, notes })
  })
}

// Calendar Meetings
export const calendarAPI = {
  getToday: () => fetchAPI('/calendar'),
  
  getByDate: (date) => fetchAPI(`/calendar?target_date=${date}`),
  
  getWeek: (startDate) => {
    const query = startDate ? `?start_date=${startDate}` : ''
    return fetchAPI(`/calendar/week${query}`)
  },
  
  getById: (id) => fetchAPI(`/calendar/${id}`),
  
  create: (data) => fetchAPI('/calendar', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  
  update: (id, data) => fetchAPI(`/calendar/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  
  delete: (id) => fetchAPI(`/calendar/${id}`, {
    method: 'DELETE'
  }),
  
  // Screenshot extraction
  extractFromScreenshot: (data) => fetchAPI('/calendar/extract-from-screenshot', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  
  // Prep Notes
  addNote: (meetingId, data) => fetchAPI(`/calendar/${meetingId}/notes`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  
  updateNote: (meetingId, noteId, data) => fetchAPI(`/calendar/${meetingId}/notes/${noteId}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  
  deleteNote: (meetingId, noteId) => fetchAPI(`/calendar/${meetingId}/notes/${noteId}`, {
    method: 'DELETE'
  }),
  
  toggleNote: (meetingId, noteId) => fetchAPI(`/calendar/${meetingId}/notes/${noteId}/toggle`, {
    method: 'POST'
  })
}

// Quick Notes
export const quickNotesAPI = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return fetchAPI(`/notes${query ? `?${query}` : ''}`)
  },
  
  getById: (id) => fetchAPI(`/notes/${id}`),
  
  create: (data) => fetchAPI('/notes', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  
  update: (id, data) => fetchAPI(`/notes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  
  togglePin: (id) => fetchAPI(`/notes/${id}/toggle-pin`, {
    method: 'POST'
  }),
  
  delete: (id) => fetchAPI(`/notes/${id}`, {
    method: 'DELETE'
  })
}
