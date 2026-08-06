import { useEffect, useState } from 'react'
import { workoutApi, type WorkoutRecord } from '../api'

const BASE = '/api'
function getHeaders() { const t = localStorage.getItem('fitness_token'); return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) } }
function fmtDur(sec: number): { num: string; unit: string } {
  const m = Math.floor(sec / 60)
  if (m === 0) return { num: '-', unit: '' }
  if (m < 60) return { num: String(m), unit: '分' }
  const h = Math.floor(m / 60)
  return { num: `${h}时${m % 60}`, unit: '' }
}

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
  const [view, setView] = useState<'today' | 'week' | 'month'>('today')
  const [sessions, setSessions] = useState<{ date: string; duration_seconds: number }[]>([])
  const [cursorDate, setCursorDate] = useState(todayStr())

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
  const weekStart = view === 'today' ? cursorDate : view === 'week' ? weekMonday(cursorDate) : monthStart(cursorDate)

  // 导航
  const goPrev = () => {
    if (view === 'today') setCursorDate(addDays(cursorDate, -1))
    else if (view === 'week') setCursorDate(addDays(cursorDate, -7))
    else { const [y, m] = cursorDate.split('-').map(Number); setCursorDate(m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`) }
  }
  const goNext = () => {
    if (view === 'today') setCursorDate(addDays(cursorDate, 1))
    else if (view === 'week') setCursorDate(addDays(cursorDate, 7))
    else { const [y, m] = cursorDate.split('-').map(Number); setCursorDate(m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`) }
  }
  const goToday = () => { setCursorDate(today); setView('today') }
  const switchView = (v: 'today' | 'week' | 'month') => { setView(v); setCursorDate(today) }

  // ─── 今日统计（用游标日期）───
  const cursorRecords = records.filter(r => r.date === cursorDate)
  const cursorExercises = cursorRecords.length
  const cursorSets = cursorRecords.reduce((s, r) => s + (r.completed_sets || 0), 0)
  const cursorTarget = cursorRecords.reduce((s, r) => s + (r.target_sets || r.sets || 0), 0)
  const cursorDuration = sessions.filter(s => s.date === cursorDate).reduce((a, s) => a + s.duration_seconds, 0)
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
  // 趋势图结束日期不超出今天
  const _end = view === 'today' ? cursorDate : view === 'week' ? addDays(weekStart, 6) : monthEnd(weekStart)
  const periodEnd = _end > today ? today : _end
  const dailyData: { label: string; sets: number; duration: number; fullDate: string }[] = []
  let cursor = weekStart
  while (cursor <= periodEnd) {
    const parts = cursor.split('-').map(Number)
    const sess = sessions.find(s => s.date === cursor)
    dailyData.push({ label: `${parts[1]}/${parts[2]}`, sets: 0, duration: sess ? Math.floor(sess.duration_seconds / 60) : 0, fullDate: cursor })
    cursor = addDays(cursor, 1)
  }
  periodRecords.forEach(r => {
    const entry = dailyData.find(e => e.fullDate === r.date)
    if (entry) entry.sets += (r.completed_sets || 0)
  })

  // ─── 对比：上一训练日 ───
  const allDates = [...new Set(records.map(r => r.date))].sort()
  const prevTrainDay = view === 'today'
    ? allDates.filter(d => d < cursorDate).pop() || null
    : null
  const prevTrainSets = prevTrainDay
    ? records.filter(r => r.date === prevTrainDay).reduce((s, r) => s + (r.completed_sets || 0), 0)
    : 0
  const prevStart = !prevTrainDay ? (view === 'today' ? addDays(cursorDate, -1) : view === 'week' ? addDays(weekStart, -7) : (() => { const [y, m] = weekStart.split('-').map(Number); const pm = m - 1 === 0 ? 12 : m - 1; const py = m - 1 === 0 ? y - 1 : y; return `${py}-${String(pm).padStart(2, '0')}-01` })()) : ''
  const prevSets = view === 'today' && prevTrainDay
    ? prevTrainSets
    : records.filter(r => r.date >= prevStart && r.date < weekStart).reduce((s, r) => s + (r.completed_sets || 0), 0)
  const periodDays = daysSet.size

  const fmtDate = (s: string) => { const d = new Date(s.split('-').map(Number)[0], s.split('-').map(Number)[1] - 1, s.split('-').map(Number)[2]); return `${d.getMonth() + 1}月${d.getDate()}日 周${WD[d.getDay()]}` }

  const maxDailySets = Math.max(...dailyData.map(d => d.sets), 1)
  const maxDailyDur = Math.max(...dailyData.map(d => d.duration), 1)

  const isMonth = view === 'month'

  return (
    <div style={{ paddingBottom: 20 }}>
      {/* ─── 导航栏 ─── */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <button onClick={goPrev} style={{ border: 'none', background: 'none', fontSize: '1.1rem', cursor: 'pointer', padding: '6px 8px', color: 'var(--text-secondary)' }}>◀</button>
        <span style={{
          fontSize: '.9rem', fontWeight: 600, textAlign: 'center', flex: 1,
          color: cursorDate === today && view === 'today' ? 'var(--primary)' : 'var(--text)',
        }}>
          {view === 'today' ? `${cursorDate.slice(5)}` : view === 'week'
            ? `${weekStart.slice(5)}~${addDays(weekStart, 6).slice(5)}`
            : `${cursorDate.slice(0, 4)}年${parseInt(cursorDate.slice(5, 7))}月`}
          {cursorDate !== today && (
            <button onClick={goToday} className="btn btn-secondary btn-sm" style={{ fontSize: '.65rem', padding: '2px 8px', marginLeft: 6, verticalAlign: 'middle' }}>回今天</button>
          )}
        </span>
        <button onClick={goNext} style={{ border: 'none', background: 'none', fontSize: '1.1rem', cursor: 'pointer', padding: '6px 8px', color: 'var(--text-secondary)' }}>▶</button>
      </div>

      {/* 日期选择 + 视图切换 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <input type="date" value={cursorDate} onChange={e => setCursorDate(e.target.value)}
          style={{ padding: '4px 8px', fontSize: '.72rem', border: '1px solid var(--border)', borderRadius: 6, background: '#fff', fontFamily: 'inherit', flex: 1 }} />
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {(['today', 'week', 'month'] as const).map(v => (
            <button key={v} onClick={() => switchView(v)} className={`btn btn-sm ${view === v ? 'btn-primary' : 'btn-secondary'}`} style={{ minWidth: 52 }}>
              {v === 'today' ? '本日' : v === 'week' ? '本周' : '本月'}
            </button>
          ))}
        </div>
      </div>

      {/* ─── 今日训练（仅本日视图）─── */}
      {view === 'today' && (
        <div style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', borderRadius: 12, padding: '16px 18px', marginBottom: 12, color: '#fff' }}>
          <div style={{ fontSize: '.75rem', opacity: 0.8, marginBottom: 4 }}>📅 {fmtDate(cursorDate)}</div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, lineHeight: 1.1 }}>{cursorExercises}</div>
              <div style={{ fontSize: '.72rem', opacity: 0.8 }}>训练动作</div>
            </div>
            <div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, lineHeight: 1.1 }}>{cursorSets}<span style={{ fontSize: '.85rem', fontWeight: 400 }}>/{cursorTarget}</span></div>
              <div style={{ fontSize: '.72rem', opacity: 0.8 }}>已完成/目标 组</div>
            </div>
            {cursorDuration > 0 && (
              <div>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, lineHeight: 1.1 }}>
                  {(() => { const d = fmtDur(cursorDuration); return <>{d.num}<span style={{ fontSize: '.7rem', fontWeight: 400 }}>{d.unit}</span></> })()}
                </div>
                <div style={{ fontSize: '.72rem', opacity: 0.8 }}>训练时长</div>
              </div>
            )}
            {cursorRecords.length > 0 && (
              <div style={{ flex: 1, fontSize: '.75rem', opacity: 0.85, lineHeight: 1.4 }}>
                {cursorRecords.map(r => (
                  <div key={r.id} style={{ whiteSpace: 'nowrap' }}>{r.exercise_name} {r.completed_sets || 0}/{r.target_sets || r.sets || 0}组{r.completed_sets > 0 ? ' ✅' : ''}</div>
                ))}
              </div>
            )}
          </div>
          {cursorRecords.length === 0 && <div style={{ fontSize: '.78rem', opacity: 0.7, marginTop: 4 }}>这天还没开始训练</div>}
        </div>
      )}

      {exerciseData.length === 0 ? (
        <div className="empty-state" style={{ padding: 40 }}><div style={{ fontSize: '2.2rem' }}>📊</div><p style={{ color: 'var(--text-secondary)' }}>{view === 'today' ? '今天' : view === 'week' ? '本周' : '本月'}暂无训练记录</p></div>
      ) : (
        <>
          {/* ─── 周期概览 ─── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
            {(() => {
              const dur = fmtDur(periodDuration)
              const prevLabel = view === 'today'
                ? (prevTrainDay ? `较${prevTrainDay.slice(5)}` : '无历史')
                : `较上${view === 'week' ? '周' : '月'}`
              const items: { v: React.ReactNode; l: string; c: string }[] = [
                { v: totalSets, l: '总组数', c: 'var(--primary)' },
                { v: periodDays, l: '训练天', c: 'var(--green)' },
                { v: periodDuration > 0 ? <>{dur.num}<span style={{ fontSize: '.6rem' }}>{dur.unit}</span></> : '-', l: '训练时长', c: 'var(--blue)' },
                { v: prevSets > 0 ? (totalSets >= prevSets ? '+' : '') + (totalSets - prevSets) : '-', l: prevLabel, c: totalSets >= prevSets ? 'var(--green)' : 'var(--red)' },
              ]
              return items.map((item, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--border)', padding: '10px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: item.c, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.v}</div>
                  <div style={{ fontSize: '.65rem', color: 'var(--text-secondary)' }}>{item.l}</div>
                </div>
              ))
            })()}
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

          {/* ─── 周/月：每日趋势 ─── */}
          {view !== 'today' && (<>
            <div className="card" style={{ marginBottom: 12 }}>
              <h2 style={{ fontSize: '.9rem', marginBottom: 2 }}>📈 每日组数 · 共{totalSets}组 · 练了{periodDays}天</h2>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: isMonth ? 0 : 3, height: 120, paddingTop: 16 }}>
                {dailyData.map((d, i) => {
                  const barH = d.sets > 0 ? Math.max((d.sets / maxDailySets) * 92, 10) : 2
                  const isToday = d.fullDate === today
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
                      <span style={{ fontSize: isMonth ? '.45rem' : '.58rem', fontWeight: d.sets > 0 ? 600 : 400, color: d.sets > 0 ? 'var(--primary)' : '#c0c8d4', marginBottom: 3, whiteSpace: 'nowrap' }}>
                        {d.sets > 0 ? d.sets : ''}
                      </span>
                      <div style={{ width: '100%', maxWidth: isMonth ? 9 : 22, height: barH, borderRadius: '3px 3px 0 0', background: isToday ? 'var(--primary)' : d.sets > 0 ? '#a5b4fc' : '#e2e8f0' }} />
                      <span style={{ fontSize: isMonth ? '.4rem' : '.48rem', color: isToday ? 'var(--primary)' : '#94a3b8', marginTop: 4, fontWeight: isToday ? 700 : 400, whiteSpace: 'nowrap', writingMode: isMonth ? 'vertical-rl' as any : 'horizontal-tb' }}>
                        {d.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="card">
              <h2 style={{ fontSize: '.9rem', marginBottom: 2 }}>⏱️ 每日时长 · 共{(() => { const d = fmtDur(periodDuration); return <>{d.num}<span style={{ fontSize: '.6rem' }}>{d.unit}</span></> })()}</h2>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: isMonth ? 0 : 3, height: 120, paddingTop: 16 }}>
                {dailyData.map((d, i) => {
                  const barH = d.duration > 0 ? Math.max((d.duration / maxDailyDur) * 92, 10) : 2
                  const isToday = d.fullDate === today
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
                      <span style={{ fontSize: isMonth ? '.45rem' : '.58rem', fontWeight: d.duration > 0 ? 600 : 400, color: d.duration > 0 ? 'var(--green)' : '#c0c8d4', marginBottom: 3, whiteSpace: 'nowrap' }}>
                        {d.duration > 0 ? d.duration : ''}
                      </span>
                      <div style={{ width: '100%', maxWidth: isMonth ? 9 : 22, height: barH, borderRadius: '3px 3px 0 0', background: isToday ? 'var(--green)' : d.duration > 0 ? '#86efac' : '#e2e8f0' }} />
                      <span style={{ fontSize: isMonth ? '.4rem' : '.48rem', color: isToday ? 'var(--green)' : '#94a3b8', marginTop: 4, fontWeight: isToday ? 700 : 400, whiteSpace: 'nowrap', writingMode: isMonth ? 'vertical-rl' as any : 'horizontal-tb' }}>
                        {d.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </>)}
        </>
      )}
    </div>
  )
}
