import { useState, useEffect } from 'react'
import { Users, Calendar, TrendingUp, MessageSquare } from 'lucide-react'
import { analyticsAPI } from '../services/api'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import './Analytics.css'

const COLORS = ['#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa']

function Analytics() {
  const [overview, setOverview] = useState(null)
  const [topicTrends, setTopicTrends] = useState(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState(6)
  
  useEffect(() => {
    loadData()
  }, [timeRange])
  
  async function loadData() {
    try {
      setLoading(true)
      const [overviewData, trendsData] = await Promise.all([
        analyticsAPI.getOverview(),
        analyticsAPI.getTopicTrends(timeRange)
      ])
      setOverview(overviewData)
      setTopicTrends(trendsData)
    } catch (err) {
      console.error('Failed to load analytics:', err)
    } finally {
      setLoading(false)
    }
  }
  
  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    )
  }
  
  // Prepare chart data
  const meetingsChartData = Object.entries(overview?.meetings_per_month || {}).map(([month, count]) => ({
    month,
    count
  }))
  
  const sentimentData = Object.entries(overview?.sentiment_distribution || {}).map(([name, value]) => ({
    name: name === 'positive' ? 'חיובי' : name === 'negative' ? 'שלילי' : 'ניטרלי',
    value
  }))
  
  const topicsChartData = overview?.top_topics?.slice(0, 8).map(t => ({
    name: t.topic,
    count: t.count
  })) || []
  
  return (
    <div className="analytics-page">
      <header className="page-header">
        <h1>אנליטיקס</h1>
        <div className="time-selector">
          <button 
            className={`time-btn ${timeRange === 3 ? 'active' : ''}`}
            onClick={() => setTimeRange(3)}
          >
            3 חודשים
          </button>
          <button 
            className={`time-btn ${timeRange === 6 ? 'active' : ''}`}
            onClick={() => setTimeRange(6)}
          >
            6 חודשים
          </button>
          <button 
            className={`time-btn ${timeRange === 12 ? 'active' : ''}`}
            onClick={() => setTimeRange(12)}
          >
            שנה
          </button>
        </div>
      </header>
      
      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <Users className="stat-icon" size={24} />
          <div className="stat-value">{overview?.total_employees || 0}</div>
          <div className="stat-label">עובדים</div>
        </div>
        <div className="stat-card">
          <Calendar className="stat-icon" size={24} />
          <div className="stat-value">{overview?.total_meetings || 0}</div>
          <div className="stat-label">שיחות</div>
        </div>
      </div>
      
      {/* Charts grid */}
      <div className="charts-grid">
        {/* Meetings over time */}
        {meetingsChartData.length > 0 && (
          <div className="card chart-card">
            <h3>שיחות לאורך זמן</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={meetingsChartData}>
                  <XAxis 
                    dataKey="month" 
                    stroke="#64748b"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="#64748b"
                    fontSize={12}
                  />
                  <Tooltip 
                    contentStyle={{
                      background: '#1a2234',
                      border: '1px solid #2d3a4f',
                      borderRadius: '8px'
                    }}
                    formatter={(value) => [value, 'שיחות']}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="url(#barGradient)"
                    radius={[4, 4, 0, 0]}
                  />
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#818cf8" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        
        {/* Sentiment distribution */}
        {sentimentData.length > 0 && (
          <div className="card chart-card">
            <h3>התפלגות סנטימנט</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={sentimentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {sentimentData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.name === 'חיובי' ? '#34d399' : entry.name === 'שלילי' ? '#f87171' : '#64748b'} 
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      background: '#1a2234',
                      border: '1px solid #2d3a4f',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        
        {/* Top topics */}
        {topicsChartData.length > 0 && (
          <div className="card chart-card topics-chart">
            <h3>נושאים מובילים</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topicsChartData} layout="vertical">
                  <XAxis 
                    type="number"
                    stroke="#64748b"
                    fontSize={12}
                  />
                  <YAxis 
                    type="category"
                    dataKey="name"
                    stroke="#64748b"
                    fontSize={12}
                    width={100}
                  />
                  <Tooltip 
                    contentStyle={{
                      background: '#1a2234',
                      border: '1px solid #2d3a4f',
                      borderRadius: '8px'
                    }}
                    formatter={(value) => [value, 'פעמים']}
                  />
                  <Bar 
                    dataKey="count" 
                    radius={[0, 4, 4, 0]}
                  >
                    {topicsChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
      
      {/* Topic trends table */}
      {topicTrends && Object.keys(topicTrends).length > 0 && (
        <div className="card">
          <h3>מגמות נושאים לפי חודש</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>נושא</th>
                  {Object.keys(topicTrends).sort().map(month => (
                    <th key={month}>{month}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {getAllTopics(topicTrends).slice(0, 10).map(topic => (
                  <tr key={topic}>
                    <td>{topic}</td>
                    {Object.keys(topicTrends).sort().map(month => (
                      <td key={month}>
                        {topicTrends[month][topic] || '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function getAllTopics(trends) {
  const topics = new Set()
  Object.values(trends).forEach(month => {
    Object.keys(month).forEach(topic => topics.add(topic))
  })
  return Array.from(topics)
}

export default Analytics

