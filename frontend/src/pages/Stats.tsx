import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts'
import { workoutApi, type WorkoutRecord } from '../api'

function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function addDays(s: string, n: number) { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
function weekMonday(s: string) { const d = new Date(s + 'T00:00:00'); const dow = d.getDay() || 7; d.setDate(d.getDate() - dow + 1); return d.toISOString().slice(0, 10) }
function monthStart(s: string) { return s.slice(0, 7) + '-01' }

const COLORS = ['#4f46e5', '#22c55e', '#eab308', '#ef4444', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#6366f1']

export default function Stats() {
  const [records, setRecords] = useState<WorkoutRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'week' | 'month'>('week')

  useEffect(() => {
    const to = todayStr()
    const from = addDays(to, -60)
    workoutApi.list({ date_from: from, date_to: to, page_size: '500' })
      .then(r => setRecords(r.data || [])).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading-spinner"><div className="spin" />加载中...</div>

  const today = todayStr()
  const weekStart = view === 'week' ? weekMonday(today) : monthStart(today)
  const periodRecords = records.filter(r => r.date >= weekStart)
  const prevPeriodStart = view === 'week' ? addDays(weekStart, -7) : (() => { const d = new Date(weekStart); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10) })()

  // ═══ 按动作累计 ═══
  const byExercise: Record<string, number> = {}
  let totalSets = 0; const daysSet = new Set<string>()
  periodRecords.forEach(r => {
    const sets = r.completed_sets || r.sets || 0
    byExercise[r.exercise_name] = (byExercise[r.exercise_name] || 0) + sets
    totalSets += sets
    daysSet.add(r.date)
  })

  const exerciseData = Object.entries(byExercise)
    .map(([name, sets]) => ({ name, sets }))
    .sort((a, b) => b.sets - a.sets)

  // ═══ 每日趋势 ═══
  const dailyMap: Record<string, { sets: number }> = {}
  const endDate = today
  let cursor = weekStart
  while (cursor <= endDate) {
    dailyMap[cursor] = { sets: 0 }
    cursor = addDays(cursor, 1)
  }
  periodRecords.forEach(r => { if (dailyMap[r.date]) dailyMap[r.date].sets += (r.completed_sets || r.sets || 0) })
  const dailyData = Object.entries(dailyMap).map(([date, v]) => {
    const dt = new Date(date + 'T00:00:00')
    return { date, label: `${dt.getMonth() + 1}/${dt.getDate()}`, sets: v.sets }
  })

  // ═══ 上周/上月对比 ═══
  const prevRecords = records.filter(r => r.date >= prevPeriodStart && r.date < weekStart)
  const prevSets = prevRecords.reduce((s, r) => s + (r.completed_sets || r.sets || 0), 0)

  return (
    <div style={{ paddingBottom: 20 }}>
      {/* 切换 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(['week', 'month'] as const).map(v => (
          <button key={v} onClick={() => setView(v)} className={`btn btn-sm ${view === v ? 'btn-primary' : 'btn-secondary'}`}>
            {v === 'week' ? '本周' : '本月'}
          </button>
        ))}
      </div>

      {/* 概览卡 */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 14 }}>
        <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
          <div className="stat-value">{totalSets}</div>
          <div className="stat-label">总组数</div>
        </div>
        <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
          <div className="stat-value">{daysSet.size}</div>
          <div className="stat-label">训练天数</div>
        </div>
        <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
          <div className="stat-value" style={{ color: totalSets > prevSets ? 'var(--green)' : totalSets < prevSets ? 'var(--red)' : 'inherit' }}>
            {prevSets > 0 ? (totalSets >= prevSets ? '+' : '') + (totalSets - prevSets) : '-'}
          </div>
          <div className="stat-label">较上{view === 'week' ? '周' : '月'}</div>
        </div>
      </div>

      {/* 按动作累计 */}
      {exerciseData.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: '.9rem', marginBottom: 10 }}>🏋️ 动作分布</h2>
          <ResponsiveContainer width="100%" height={Math.max(180, exerciseData.length * 32)}>
            <BarChart data={exerciseData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} width={70} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v) => [`${v} 组`, '完成']} />
              <Bar dataKey="sets" radius={[0, 4, 4, 0]}>
                {exerciseData.map((_, i) => <rect key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 每日趋势 */}
      {dailyData.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: '.9rem', marginBottom: 10 }}>📈 每日趋势</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} interval={view === 'month' ? 2 : 0} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v) => [`${v} 组`, '完成']} />
              <Bar dataKey="sets" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {exerciseData.length === 0 && (
        <div className="empty-state"><div style={{ fontSize: '2.2rem' }}>📊</div><p style={{ color: 'var(--text-secondary)' }}>{view === 'week' ? '本周' : '本月'}暂无训练记录</p></div>
      )}
    </div>
  )
}
