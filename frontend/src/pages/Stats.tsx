import { useEffect, useState } from 'react'
import { workoutApi, type WorkoutRecord } from '../api'

const BASE = '/api'
function getHeaders() { const t = localStorage.getItem('fitness_token'); return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) } }
function fmtDuration(sec: number): string { const m = Math.floor(sec / 60); if (m < 60) return `${m}分钟`; const h = Math.floor(m / 60); return `${h}小时${m % 60}分钟` }

function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function addDays(s: string, n: number) { const [y, m, d] = s.split('-').map(Number); const dt = new Date(y, m - 1, d); dt.setDate(dt.getDate() + n); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}` }
function weekMonday(s: string) { const [y, m, d] = s.split('-').map(Number); const dt = new Date(y, m - 1, d); const dow = dt.getDay() || 7; dt.setDate(dt.getDate() - dow + 1); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}` }
function monthStart(s: string) { return s.slice(0, 7) + '-01' }
function monthEnd(s: string) { const [y, m] = s.split('-').map(Number); return `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}` }

const WD = ['日', '一', '二', '三', '四', '五', '六']

const EX_COLORS = ['#4f46e5', '#22c55e', '#eab308', '#ef4444', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#6366f1']

export default function Stats() {
  const [records, setRecords] = useState<WorkoutRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [view, setView] = useState<'week' | 'month'>('week')
  const [sessions, setSessions] = useState<{ date: string; duration_seconds: number }[]>([])

  useEffect(() => {
    const from = addDays(todayStr(), -90)
    Promise.all([
      workoutApi.list({ date_from: from, page_size: '200' }),
      fetch(BASE + '/sessions/?date_from=' + from, { headers: getHeaders() }).then(r => r.ok ? r.json() : []),
    ]).then(([wr, ss]) => {
      setRecords(Array.isArray(wr?.data) ? wr.data : [])
      setSessions(Array.isArray(ss) ? ss : [])
    }).catch(() => setError(true))
    .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading-spinner"><div className="spin" />加载中...</div>
  if (error) return <div className="empty-state" style={{ padding: 40 }}><p style={{ color: 'var(--text-secondary)' }}>加载失败，请刷新重试</p></div>

  const today = todayStr()
  const weekStart = view === 'week' ? weekMonday(today) : monthStart(today)

  // ─── 今日统计 ───
  const todayRecords = records.filter(r => r.date === today)
  const todayExercises = todayRecords.length
  const todaySets = todayRecords.reduce((s, r) => s + (r.completed_sets || 0), 0)
  const todayTarget = todayRecords.reduce((s, r) => s + (r.target_sets || r.sets || 0), 0)
  const todayDuration = sessions.filter(s => s.date === today).reduce((a, s) => a + s.duration_seconds, 0)
  const periodDuration = sessions.filter(s => s.date >= weekStart).reduce((a, s) => a + s.duration_seconds, 0)

  // ─── 周期统计 ───
  const periodRecords = records.filter(r => r.date >= weekStart)
  const byExercise: Record<string, number> = {}
  let totalSets = 0
  const daysSet = new Set<string>()
  periodRecords.forEach(r => {
    if (!r?.exercise_name) return
    const sets = r.completed_sets || 0
    byExercise[r.exercise_name] = (byExercise[r.exercise_name] || 0) + sets
    totalSets += sets
    if (sets > 0) daysSet.add(r.date)
  })

  const exerciseData = Object.entries(byExercise)
    .map(([name, sets]) => ({ name, sets }))
    .sort((a, b) => b.sets - a.sets)
  const maxExerciseSets = exerciseData.length > 0 ? exerciseData[0].sets : 1

  // ─── 每日趋势 ───
  const periodEnd = view === 'week' ? addDays(weekStart, 6) : monthEnd(weekStart)
  const dailyData: { label: string; sets: number; fullDate: string }[] = []
  let cursor = weekStart
  while (cursor <= periodEnd) {
    const parts = cursor.split('-').map(Number)
    dailyData.push({ label: `${parts[1]}/${parts[2]}`, sets: 0, fullDate: cursor })
    cursor = addDays(cursor, 1)
  }
  periodRecords.forEach(r => {
    const entry = dailyData.find(e => e.fullDate === r.date)
    if (entry) entry.sets += (r.completed_sets || 0)
  })

  // ─── 对比 ───
  const prevStart = view === 'week' ? addDays(weekStart, -7) : (() => { const [y, m] = weekStart.split('-').map(Number); const pm = m - 1 === 0 ? 12 : m - 1; const py = m - 1 === 0 ? y - 1 : y; return `${py}-${String(pm).padStart(2, '0')}-01` })()
  const prevSets = records.filter(r => r.date >= prevStart && r.date < weekStart).reduce((s, r) => s + (r.completed_sets || 0), 0)
  const periodDays = daysSet.size

  const fmtDate = (s: string) => { const d = new Date(s.split('-').map(Number)[0], s.split('-').map(Number)[1] - 1, s.split('-').map(Number)[2]); return `${d.getMonth() + 1}月${d.getDate()}日 周${WD[d.getDay()]}` }

  const maxDailySets = Math.max(...dailyData.map(d => d.sets), 1)

  return (
    <div style={{ paddingBottom: 20 }}>
      {/* ─── 切换 ─── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {(['week', 'month'] as const).map(v => (
          <button key={v} onClick={() => setView(v)} className={`btn btn-sm ${view === v ? 'btn-primary' : 'btn-secondary'}`}>
            {v === 'week' ? '本周' : '本月'}
          </button>
        ))}
      </div>

      {/* ─── 今日训练 ─── */}
      <div style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', borderRadius: 12, padding: '16px 18px', marginBottom: 12, color: '#fff' }}>
        <div style={{ fontSize: '.75rem', opacity: 0.8, marginBottom: 4 }}>📅 {fmtDate(today)}</div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, lineHeight: 1.1 }}>{todayExercises}</div>
            <div style={{ fontSize: '.72rem', opacity: 0.8 }}>训练动作</div>
          </div>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, lineHeight: 1.1 }}>{todaySets}<span style={{ fontSize: '.85rem', fontWeight: 400 }}>/{todayTarget}</span></div>
            <div style={{ fontSize: '.72rem', opacity: 0.8 }}>已完成/目标 组</div>
          </div>
          {todayDuration > 0 && (
            <div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, lineHeight: 1.1 }}>{fmtDuration(todayDuration)}</div>
              <div style={{ fontSize: '.72rem', opacity: 0.8 }}>训练时长</div>
            </div>
          )}
          {todayRecords.length > 0 && (
            <div style={{ flex: 1, fontSize: '.75rem', opacity: 0.85, lineHeight: 1.4 }}>
              {todayRecords.map(r => (
                <div key={r.id}>{r.exercise_name} {r.completed_sets || 0}/{r.target_sets || r.sets || 0}组 {r.completed_sets > 0 ? '✅' : ''}</div>
              ))}
            </div>
          )}
        </div>
        {todayRecords.length === 0 && <div style={{ fontSize: '.78rem', opacity: 0.7, marginTop: 4 }}>今天还没开始训练</div>}
      </div>

      {exerciseData.length === 0 ? (
        <div className="empty-state" style={{ padding: 40 }}><div style={{ fontSize: '2.2rem' }}>📊</div><p style={{ color: 'var(--text-secondary)' }}>{view === 'week' ? '本周' : '本月'}暂无训练记录</p></div>
      ) : (
        <>
          {/* ─── 周期概览 ─── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
            {[
              { v: totalSets, l: '总组数', c: 'var(--primary)' },
              { v: periodDays, l: '训练天', c: 'var(--green)' },
              { v: periodDuration > 0 ? fmtDuration(periodDuration) : '-', l: '训练时长', c: 'var(--blue)' },
              { v: prevSets > 0 ? (totalSets >= prevSets ? '+' : '') + (totalSets - prevSets) : '-', l: `较上${view === 'week' ? '周' : '月'}`, c: totalSets >= prevSets ? 'var(--green)' : 'var(--red)' },
            ].map((item, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--border)', padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: item.c }}>{item.v}</div>
                <div style={{ fontSize: '.68rem', color: 'var(--text-secondary)' }}>{item.l}</div>
              </div>
            ))}
          </div>

          {/* ─── 动作分布（自定义柱状图，数字标在条上）─── */}
          <div className="card" style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: '.9rem', marginBottom: 10 }}>🏋️ 动作分布</h2>
            {exerciseData.map((ex, i) => (
              <div key={ex.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ width: 60, fontSize: '.78rem', fontWeight: 500, textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name}</span>
                <div style={{ flex: 1, height: 22, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                  <div style={{
                    height: '100%', width: `${Math.max((ex.sets / maxExerciseSets) * 100, ex.sets > 0 ? 8 : 0)}%`,
                    background: EX_COLORS[i % EX_COLORS.length], borderRadius: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6,
                    transition: 'width 0.4s ease',
                  }}>
                    <span style={{ color: '#fff', fontSize: '.7rem', fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>{ex.sets}组</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ─── 每日趋势（纯CSS柱状图，无抖动）─── */}
          <div className="card">
            <h2 style={{ fontSize: '.9rem', marginBottom: 10 }}>📈 每日趋势</h2>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: view === 'month' ? 2 : 4, height: 160, paddingTop: 20 }}>
              {dailyData.map((d, i) => {
                const barH = d.sets > 0 ? Math.max((d.sets / maxDailySets) * 130, 16) : 2
                const isToday = d.fullDate === today
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
                    <span style={{ fontSize: '.6rem', fontWeight: d.sets > 0 ? 600 : 400, color: d.sets > 0 ? 'var(--primary)' : '#c0c8d4', marginBottom: 3, whiteSpace: 'nowrap' }}>
                      {d.sets > 0 ? d.sets : ''}
                    </span>
                    <div style={{
                      width: '100%', maxWidth: 28, height: barH, borderRadius: '4px 4px 0 0',
                      background: isToday ? 'var(--primary)' : d.sets > 0 ? '#818cf8' : '#e2e8f0',
                      transition: 'height 0.3s ease',
                    }} />
                    <span style={{ fontSize: '.6rem', color: isToday ? 'var(--primary)' : '#94a3b8', marginTop: 4, fontWeight: isToday ? 700 : 400, whiteSpace: 'nowrap' }}>
                      {d.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
