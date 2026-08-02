import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts'
import { workoutApi, type WorkoutRecord } from '../api'

export default function Stats() {
  const [weekData, setWeekData] = useState<{ day: string; sets: number; exercises: number }[]>([])
  const [monthDays, setMonthDays] = useState(0)
  const [monthSets, setMonthSets] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load last 30 days of workouts
    const to = new Date().toISOString().slice(0, 10)
    const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    workoutApi.list({ date_from: from, date_to: to, page_size: '500' })
      .then(r => {
        const records: WorkoutRecord[] = r.data || []

        // This week: Mon-Sun
        const now = new Date()
        const dayOfWeek = now.getDay() || 7 // Sun=7
        const monday = new Date(now); monday.setDate(now.getDate() - dayOfWeek + 1)
        const weekMap: Record<string, { sets: number; exercises: Set<string> }> = {}
        for (let i = 0; i < 7; i++) {
          const d = new Date(monday); d.setDate(monday.getDate() + i)
          weekMap[d.toISOString().slice(0, 10)] = { sets: 0, exercises: new Set() }
        }
        records.forEach(r => {
          const key = r.date
          if (weekMap[key]) {
            weekMap[key].sets += r.completed_sets || r.sets || 0
            weekMap[key].exercises.add(r.exercise_name)
          }
        })
        const wd = Object.entries(weekMap).map(([date, v]) => ({
          day: `${new Date(date + 'T00:00:00').getMonth() + 1}/${new Date(date + 'T00:00:00').getDate()}`,
          sets: v.sets,
          exercises: v.exercises.size,
        }))
        setWeekData(wd)

        // This month
        const nowStr = now.toISOString().slice(0, 7)
        const monthRecords = records.filter(r => r.date.startsWith(nowStr))
        const uniqueDays = new Set(monthRecords.map(r => r.date))
        setMonthDays(uniqueDays.size)
        setMonthSets(monthRecords.reduce((s, r) => s + (r.completed_sets || r.sets || 0), 0))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading-spinner"><div className="spin" />加载中...</div>

  return (
    <div style={{ paddingBottom: 20 }}>
      {/* Month summary */}
      <div className="stats-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-icon blue">📊</div>
          <div><div className="stat-value">{monthSets}</div><div className="stat-label">本月组数</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">📅</div>
          <div><div className="stat-value">{monthDays}</div><div className="stat-label">本月训练天数</div></div>
        </div>
      </div>

      {/* Week chart */}
      <div className="card">
        <h2 style={{ fontSize: '.95rem', marginBottom: 12 }}>📈 本周训练量</h2>
        {weekData.every(d => d.sets === 0) ? (
          <div className="empty-state" style={{ padding: 24 }}>
            <p style={{ fontSize: '.85rem', color: 'var(--text-secondary)' }}>本周暂无训练记录</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weekData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
                formatter={(v: number) => [`${v} 组`, '完成']} />
              <Bar dataKey="sets" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
