import { useEffect, useState, Component } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell } from 'recharts'
import { workoutApi, type WorkoutRecord } from '../api'

function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function addDays(s: string, n: number) { const [y, m, d] = s.split('-').map(Number); const dt = new Date(y, m - 1, d); dt.setDate(dt.getDate() + n); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}` }
function weekMonday(s: string) { const [y, m, d] = s.split('-').map(Number); const dt = new Date(y, m - 1, d); const dow = dt.getDay() || 7; dt.setDate(dt.getDate() - dow + 1); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}` }
function monthStart(s: string) { return s.slice(0, 7) + '-01' }

const COLORS = ['#4f46e5', '#22c55e', '#eab308', '#ef4444', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#6366f1']

// 错误边界：防止 Recharts 崩溃导致整个页面白屏
class ChartErrorBoundary extends Component<{ fallback: React.ReactNode; children: React.ReactNode }> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

export default function Stats() {
  const [records, setRecords] = useState<WorkoutRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [view, setView] = useState<'week' | 'month'>('week')

  useEffect(() => {
    const to = todayStr()
    const from = addDays(to, -60)
    workoutApi.list({ date_from: from, date_to: to, page_size: '500' })
      .then(r => { setRecords(Array.isArray(r?.data) ? r.data : []) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading-spinner"><div className="spin" />加载中...</div>
  if (error) return <div className="empty-state" style={{ padding: 40 }}><p style={{ color: 'var(--text-secondary)' }}>加载失败，请刷新重试</p></div>

  const today = todayStr()
  const weekStart = view === 'week' ? weekMonday(today) : monthStart(today)

  const periodRecords = records.filter(r => r.date >= weekStart)

  // 按动作累计（防御：跳过异常数据）
  const byExercise: Record<string, number> = {}
  let totalSets = 0
  const daysSet = new Set<string>()
  periodRecords.forEach(r => {
    if (!r?.exercise_name) return
    const sets = r.completed_sets || r.sets || 0
    byExercise[r.exercise_name] = (byExercise[r.exercise_name] || 0) + sets
    totalSets += sets
    daysSet.add(r.date)
  })

  const exerciseData = Object.entries(byExercise)
    .map(([name, sets]) => ({ name, sets }))
    .sort((a, b) => b.sets - a.sets)

  // 每日趋势
  const dailyData: { label: string; sets: number }[] = []
  let cursor = weekStart
  while (cursor <= today) {
    const parts = cursor.split('-').map(Number)
    dailyData.push({ label: `${parts[1]}/${parts[2]}`, sets: 0 })
    cursor = addDays(cursor, 1)
  }
  periodRecords.forEach(r => {
    const entry = dailyData.find(e => e.label === `${parseInt(r.date.slice(5, 7))}/${parseInt(r.date.slice(8, 10))}`)
    if (entry) entry.sets += (r.completed_sets || r.sets || 0)
  })

  // 上期对比
  const prevStart = view === 'week' ? addDays(weekStart, -7) : (() => { const [y, m] = weekStart.split('-').map(Number); const pm = m - 1 === 0 ? 12 : m - 1; const py = m - 1 === 0 ? y - 1 : y; return `${py}-${String(pm).padStart(2, '0')}-01` })()
  const prevSets = records.filter(r => r.date >= prevStart && r.date < weekStart).reduce((s, r) => s + (r.completed_sets || r.sets || 0), 0)

  const chartFallback = <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', fontSize: '.85rem' }}>图表加载失败</div>

  return (
    <div style={{ paddingBottom: 20 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(['week', 'month'] as const).map(v => (
          <button key={v} onClick={() => setView(v)} className={`btn btn-sm ${view === v ? 'btn-primary' : 'btn-secondary'}`}>
            {v === 'week' ? '本周' : '本月'}
          </button>
        ))}
      </div>

      {exerciseData.length === 0 ? (
        <div className="empty-state" style={{ padding: 40 }}><div style={{ fontSize: '2.2rem' }}>📊</div><p style={{ color: 'var(--text-secondary)' }}>{view === 'week' ? '本周' : '本月'}暂无训练</p></div>
      ) : (
        <>
          {/* 概览 */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 14 }}>
            <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}><div className="stat-value">{totalSets}</div><div className="stat-label">总组数</div></div>
            <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}><div className="stat-value">{daysSet.size}</div><div className="stat-label">训练天数</div></div>
            <div className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}><div className="stat-value" style={{ color: totalSets >= prevSets ? 'var(--green)' : 'var(--red)' }}>{prevSets > 0 ? (totalSets >= prevSets ? '+' : '') + (totalSets - prevSets) : '-'}</div><div className="stat-label">较上{view === 'week' ? '周' : '月'}</div></div>
          </div>

          {/* 动作分布 */}
          <div className="card" style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: '.9rem', marginBottom: 10 }}>🏋️ 动作分布</h2>
            <ChartErrorBoundary fallback={chartFallback}>
              <div style={{ width: '100%', height: Math.max(200, exerciseData.length * 34) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={exerciseData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} width={70} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v) => [`${v} 组`, '完成']} />
                    <Bar dataKey="sets" radius={[0, 4, 4, 0]}>
                      {exerciseData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartErrorBoundary>
          </div>

          {/* 每日趋势 */}
          <div className="card">
            <h2 style={{ fontSize: '.9rem', marginBottom: 10 }}>📈 每日趋势</h2>
            <ChartErrorBoundary fallback={chartFallback}>
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} interval={view === 'month' ? 2 : 0} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v) => [`${v} 组`, '完成']} />
                    <Bar dataKey="sets" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartErrorBoundary>
          </div>
        </>
      )}
    </div>
  )
}
