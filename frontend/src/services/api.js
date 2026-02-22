const API_BASE = import.meta.env.VITE_API_URL || 'https://taskflow-production-6cb6.up.railway.app/api'

// Helper to get current user ID from localStorage
function getCurrentUserId() {
  try {
    const user = localStorage.getItem('taskflow_user')
    if (user) {
      return JSON.parse(user).id
    }
  } catch (e) {
    console.error('Error getting user ID:', e)
  }
  return null
}

// Helper to add user_id to params
function addUserIdToParams(params = {}) {
  const userId = getCurrentUserId()
  if (userId) {
    params.user_id = userId
  }
  return params
}

async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers
    },
    mode: 'cors',
    ...options
  }
  
  try {
    const response = await fetch(url, config)
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.detail || `HTTP ${response.status}`)
    }
    
    if (response.status === 204) {
      return null
    }
    
    return response.json()
  } catch (error) {
    // Better error message for network/CORS errors
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      console.error('Network error - URL:', url)
      throw new Error('שגיאת חיבור לשרת. אנא בדקי את החיבור לאינטרנט.')
    }
    throw error
  }
}

// Users API
export const usersAPI = {
  login: (username) => fetchAPI('/users/login', {
    method: 'POST',
    body: JSON.stringify({ username })
  }),
  
  getMe: (userId) => fetchAPI(`/users/me?user_id=${userId}`),
  
  checkUsername: (username) => fetchAPI(`/users/check/${username}`),
  
  migrateData: (userId) => fetchAPI(`/users/migrate-data/${userId}`, {
    method: 'POST'
  })
}

// Employees
export const employeesAPI = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(addUserIdToParams(params)).toString()
    return fetchAPI(`/employees${query ? `?${query}` : ''}`)
  },
  
  getById: (id) => fetchAPI(`/employees/${id}`),
  
  create: (data) => {
    const userId = getCurrentUserId()
    const queryStr = userId ? `?user_id=${userId}` : ''
    return fetchAPI(`/employees${queryStr}`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },
  
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
    const query = new URLSearchParams(addUserIdToParams(params)).toString()
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
    const query = new URLSearchParams(addUserIdToParams(params)).toString()
    return fetchAPI(`/tasks${query ? `?${query}` : ''}`)
  },
  
  getMy: (params = {}) => {
    const query = new URLSearchParams(addUserIdToParams(params)).toString()
    return fetchAPI(`/tasks/my${query ? `?${query}` : ''}`)
  },
  
  getDiscussTopics: (personId, includeCompleted = false) => {
    const userId = getCurrentUserId()
    const userIdParam = userId ? `&user_id=${userId}` : ''
    return fetchAPI(`/tasks/discuss/${personId}?include_completed=${includeCompleted}${userIdParam}`)
  },
  
  getToday: () => {
    const userId = getCurrentUserId()
    const queryStr = userId ? `?user_id=${userId}` : ''
    return fetchAPI(`/tasks/today${queryStr}`)
  },
  
  // Get tasks assigned to me by others
  getAssignedToMe: (includeCompleted = false) => {
    const userId = getCurrentUserId()
    if (!userId) return Promise.resolve([])
    return fetchAPI(`/tasks/assigned-to-me?user_id=${userId}&include_completed=${includeCompleted}`)
  },
  
  // Get count of assigned tasks
  getAssignedCount: () => {
    const userId = getCurrentUserId()
    if (!userId) return Promise.resolve({ count: 0 })
    return fetchAPI(`/tasks/assigned-to-me/count?user_id=${userId}`)
  },
  
  getById: (id) => fetchAPI(`/tasks/${id}`),
  
  create: (data) => {
    const userId = getCurrentUserId()
    const queryStr = userId ? `?user_id=${userId}` : ''
    return fetchAPI(`/tasks${queryStr}`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },
  
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
    const query = new URLSearchParams(addUserIdToParams(params)).toString()
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
  getToday: () => {
    const userId = getCurrentUserId()
    const queryStr = userId ? `?user_id=${userId}` : ''
    return fetchAPI(`/calendar${queryStr}`)
  },
  
  getByDate: (date) => {
    const userId = getCurrentUserId()
    const userIdStr = userId ? `&user_id=${userId}` : ''
    return fetchAPI(`/calendar?target_date=${date}${userIdStr}`)
  },
  
  getWeek: (startDate) => {
    const query = startDate ? `?start_date=${startDate}` : ''
    return fetchAPI(`/calendar/week${query}`)
  },
  
  getById: (id) => fetchAPI(`/calendar/${id}`),
  
  create: (data) => {
    const userId = getCurrentUserId()
    const queryStr = userId ? `?user_id=${userId}` : ''
    return fetchAPI(`/calendar${queryStr}`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },
  
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
    const query = new URLSearchParams(addUserIdToParams(params)).toString()
    return fetchAPI(`/notes${query ? `?${query}` : ''}`)
  },
  
  getById: (id) => fetchAPI(`/notes/${id}`),
  
  create: (data) => {
    const userId = getCurrentUserId()
    const queryStr = userId ? `?user_id=${userId}` : ''
    return fetchAPI(`/notes${queryStr}`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },
  
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
