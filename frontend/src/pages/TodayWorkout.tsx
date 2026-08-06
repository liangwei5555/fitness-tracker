import { useEffect, useState, useRef, useCallback } from 'react'
import { workoutApi, photoApi, type WorkoutRecord, type DailyPhoto } from '../api'
import ExerciseCard from '../components/ExerciseCard'

function pad2(n: number): string { return n < 10 ? `0${n}` : `${n}` }
function toDateStr(y: number, m: number, d: number): string { return `${y}-${pad2(m + 1)}-${pad2(d)}` }
function todayStr(): string { const d = new Date(); return toDateStr(d.getFullYear(), d.getMonth(), d.getDate()) }
function parseDate(s: string): Date { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
function addDays(s: string, n: number): string { const d = parseDate(s); d.setDate(d.getDate() + n); return toDateStr(d.getFullYear(), d.getMonth(), d.getDate()) }
const WD = ['日', '一', '二', '三', '四', '五', '六']
function fmtDate(s: string): string { const d = parseDate(s); return `${d.getMonth() + 1}月${d.getDate()}日 周${WD[d.getDay()]}` }
function weekMon(s: string): string { const d = parseDate(s); const dow = d.getDay() || 7; d.setDate(d.getDate() - dow + 1); return toDateStr(d.getFullYear(), d.getMonth(), d.getDate()) }
const BASE = '/api'
function getHeaders() { const t = localStorage.getItem('fitness_token'); return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) } }
function fmtDuration(sec: number): string { const m = Math.floor(sec / 60); const s = sec % 60; return `${m}:${String(s).padStart(2, '0')}` }

const DEF_EX = ['卧推', '深蹲', '硬拉', '引体向上', '哑铃飞鸟', '弯举', '推举', '划船', '俯卧撑', '卷腹']
function loadMyEx(): string[] { try { const r = localStorage.getItem('my_exercises'); if (r) { const a = JSON.parse(r); if (Array.isArray(a) && a.length) return a } } catch {} return [...DEF_EX] }
function saveMyEx(l: string[]) { localStorage.setItem('my_exercises', JSON.stringify(l)) }

export default function TodayWorkout() {
  const today = todayStr()
  const [date, setDate] = useState(today)
  const [records, setRecords] = useState<WorkoutRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', sets: '', reps: '', wt: '', pd: date })
  const [photos, setPhotos] = useState<DailyPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const [viewing, setViewing] = useState<DailyPhoto | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [myEx, setMyEx] = useState<string[]>(loadMyEx)
  const [editingEx, setEditingEx] = useState(false)
  const [newEx, setNewEx] = useState('')

  interface ExCfg { name: string; sets: number; reps: number; wt: number | null }
  interface DayPlan { date: string; label: string; exercises: { name: string; sets: number; reps: number; wt: number | null }[] }
  const [recentCfg, setRecentCfg] = useState<ExCfg[]>([])
  const [recentDays, setRecentDays] = useState<DayPlan[]>([])
  const [copying, setCopying] = useState<string | null>(null)  // 正在复制的日期
  const submitting = useRef(false)

  const [weekBase, setWeekBase] = useState(weekMon(today))
  const [delConfirm, setDelConfirm] = useState<{ type: 'duration' } | null>(null)

  // ─── 计时器 ───
  const [timerState, setTimerState] = useState<'idle' | 'running' | 'paused'>('idle')
  const [elapsedSec, setElapsedSec] = useState(0)
  const [savedSec, setSavedSec] = useState(0)
  const timerRef = useRef<number | null>(null)
  const startRef = useRef(0)
  const accumRef = useRef(0)
  const tStateRef = useRef<'idle' | 'running' | 'paused'>('idle')

  const clearTimerInterval = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } }

  const tickAndPersist = () => {
    const now = Math.floor((Date.now() - startRef.current) / 1000)
    const total = accumRef.current + now
    setElapsedSec(total)
    // 每秒保存到 localStorage，防止切换页面丢失
    localStorage.setItem('timer_state', JSON.stringify({ running: true, paused: false, elapsed: total }))
  }

  const startTimer = () => {
    clearTimerInterval()
    startRef.current = Date.now()
    setTimerState('running')
    tStateRef.current = 'running'
    localStorage.setItem('timer_state', JSON.stringify({ running: true, paused: false, elapsed: accumRef.current }))
    timerRef.current = window.setInterval(tickAndPersist, 1000)
  }

  const pauseTimer = () => {
    clearTimerInterval()
    accumRef.current += Math.floor((Date.now() - startRef.current) / 1000)
    setElapsedSec(accumRef.current)
    setTimerState('paused')
    tStateRef.current = 'paused'
    localStorage.setItem('timer_state', JSON.stringify({ running: true, paused: true, elapsed: accumRef.current }))
  }

  const resumeTimer = () => {
    clearTimerInterval()
    startRef.current = Date.now()
    setTimerState('running')
    tStateRef.current = 'running'
    localStorage.setItem('timer_state', JSON.stringify({ running: true, paused: false, elapsed: accumRef.current }))
    timerRef.current = window.setInterval(tickAndPersist, 1000)
  }

  const stopTimer = useCallback(async () => {
    clearTimerInterval()
    const final = accumRef.current + (tStateRef.current === 'running' ? Math.floor((Date.now() - startRef.current) / 1000) : 0)
    setElapsedSec(final)
    setTimerState('idle')
    tStateRef.current = 'idle'
    accumRef.current = 0
    localStorage.removeItem('timer_state')
    // 保存到后端
    try {
      const res = await fetch(BASE + '/sessions/', {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ date: todayStr(), duration_seconds: final }),
      })
      if (res.ok) {
        const d = await res.json()
        setSavedSec(d.duration_seconds)
      }
    } catch { /* ignore */ }
  }, [timerState])

  // 恢复计时器（页面刷新/切换tab后回来）
  useEffect(() => {
    const saved = localStorage.getItem('timer_state')
    if (saved) {
      try {
        const st = JSON.parse(saved)
        if (st.running) {
          accumRef.current = st.elapsed || 0
          setElapsedSec(st.elapsed || 0)
          if (!st.paused) {
            startRef.current = Date.now()
            setTimerState('running')
            tStateRef.current = 'running'
            timerRef.current = window.setInterval(tickAndPersist, 1000)
          } else {
            setTimerState('paused')
            tStateRef.current = 'paused'
          }
        }
      } catch { /* ignore */ }
    }
    // 加载今日已保存时长
    fetch(BASE + '/sessions/' + todayStr(), { headers: getHeaders() })
      .then(r => r.json()).then(d => setSavedSec(d.duration_seconds || 0)).catch(() => {})
    return () => {
      // 组件卸载时保存最新计时状态，防止切换页面丢失
      if (tStateRef.current === 'running') {
        const currentElapsed = accumRef.current + Math.floor((Date.now() - startRef.current) / 1000)
        localStorage.setItem('timer_state', JSON.stringify({ running: true, paused: false, elapsed: currentElapsed }))
      }
      clearTimerInterval()
    }
  }, [])

  // ─── 滑动 ───
  const tsX = useRef(0)
  const tsY = useRef(0)
  const dateOnStart = useRef(date)
  const dateRef = useRef(date); dateRef.current = date
  const ignoring = useRef(false)
  const modalOpen = showForm || editingEx

  const onTS = (e: React.TouchEvent) => {
    // 弹窗打开时彻底忽略所有滑动
    if (modalOpen) { ignoring.current = true; return }
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('input') || target.tagName === 'BUTTON' || target.tagName === 'INPUT') {
      ignoring.current = true; return
    }
    ignoring.current = false
    tsX.current = e.touches[0].clientX
    tsY.current = e.touches[0].clientY
    dateOnStart.current = dateRef.current
  }
  const onTE = (e: React.TouchEvent) => {
    if (ignoring.current) return
    const dx = e.changedTouches[0].clientX - tsX.current
    const dy = e.changedTouches[0].clientY - tsY.current
    if (Math.abs(dx) < 35 || Math.abs(dx) < Math.abs(dy)) return
    setDate(addDays(dateOnStart.current, dx > 0 ? -1 : 1))
  }

  // ─── 数据 ───
  const load = () => {
    // 只在首次加载时显示 loading，后续切换日期不清空已有数据
    setLoading(true)
    workoutApi.list({ date_from: date, date_to: date, page_size: '200' })
      .then(r => setRecords(r.data || []))
      .catch(() => { /* 失败时保留已有数据，不显示空状态 */ })
      .finally(() => setLoading(false))
    photoApi.list({ date_from: date, date_to: date, page_size: '100' })
      .then(r => setPhotos(r.data || [])).catch(() => {})
  }
  const loadHist = () => {
    const from = addDays(todayStr(), -90)
    workoutApi.list({ date_from: from, page_size: '200' }).then(r => {
      try {
        const recs = Array.isArray(r?.data) ? r.data : []
        if (recs.length === 0) { console.log('loadHist: 暂无历史记录'); return }
        console.log('loadHist: 获取到', recs.length, '条历史记录')

        // ── 快捷填入：去重后的动作配置 ──
        const seen = new Set<string>(); const cfgs: ExCfg[] = []
        for (const rec of recs) {
          if (!rec?.exercise_name) continue
          const k = `${rec.exercise_name}|${rec.target_sets || rec.sets || 0}|${rec.reps || 0}|${rec.weight_kg ?? 0}`
          if (!seen.has(k)) { seen.add(k); cfgs.push({ name: rec.exercise_name, sets: rec.target_sets || rec.sets || 0, reps: rec.reps || 0, wt: rec.weight_kg }) }
        }
        setRecentCfg(cfgs.slice(0, 20))

        // ── 多天历史：按日期分组，显示最近5个有记录的日子 ──
        const byDate = new Map<string, WorkoutRecord[]>()
        for (const rec of recs) {
          if (!rec?.exercise_name) continue
          if (!byDate.has(rec.date)) byDate.set(rec.date, [])
          byDate.get(rec.date)!.push(rec)
        }
        const sortedDates = [...byDate.keys()].sort().reverse().slice(0, 5)
        const plans: DayPlan[] = sortedDates.map(ds => ({
          date: ds,
          label: fmtDate(ds),
          exercises: (byDate.get(ds) || []).map(r2 => ({
            name: r2.exercise_name,
            sets: r2.target_sets || r2.sets || 0,
            reps: r2.reps || 0,
            wt: r2.weight_kg ?? null,
          }))
        }))
        setRecentDays(plans)
      } catch (e) { console.error('loadHist error:', e) }
    }).catch((e) => { console.error('loadHist fetch error:', e) })
  }
  useEffect(() => { load() }, [date])
  useEffect(() => { loadHist() }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || submitting.current) return
    submitting.current = true
    try {
      await workoutApi.create({ date: form.pd, exercise_name: form.name.trim(), target_sets: Number(form.sets) || 0, reps: Number(form.reps) || 0, weight_kg: form.wt ? Number(form.wt) : null })
      setShowForm(false)
      if (form.pd !== date) setDate(form.pd)
      load(); loadHist()
    } catch {} finally { submitting.current = false }
  }

  const handleUpdate = (r: WorkoutRecord) => setRecords(prev => prev.map(p => p.id === r.id ? r : p))
  const handleDelete = async (id: number) => { try { await workoutApi.delete(id); load() } catch {} }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setUploading(true)
    try { await photoApi.upload(f, date); load() } catch { alert('上传失败') }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }
  const delPhoto = async (id: number) => { if (!window.confirm('删除？')) return; try { await photoApi.delete(id); load(); setViewing(null) } catch {} }
  const copyDay = async (plan: DayPlan) => {
    if (!plan.exercises.length) return
    setCopying(plan.date)
    try {
      for (const ex of plan.exercises) {
        await workoutApi.create({ date, exercise_name: ex.name, target_sets: ex.sets, reps: ex.reps, weight_kg: ex.wt })
      }
      load(); loadHist()
    } catch {} finally { setCopying(null) }
  }
  const addEx = () => { const n = newEx.trim(); if (!n || myEx.includes(n)) return; const u = [...myEx, n]; setMyEx(u); saveMyEx(u); setNewEx('') }
  const rmEx = (n: string) => { const u = myEx.filter(e => e !== n); setMyEx(u); saveMyEx(u) }

  // ─── 周视图 ───
  const weekDays: { label: string; ds: string; isToday: boolean }[] = []
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekBase, i)
    weekDays.push({ label: WD[parseDate(d).getDay()], ds: d, isToday: d === today })
  }
  const chWeek = (n: number) => setWeekBase(addDays(weekBase, n * 7))

  return (
    <div style={{ paddingBottom: 20, minHeight: '100dvh', touchAction: 'pan-y' }}
      onTouchStart={onTS} onTouchEnd={onTE}>
      {/* ═══ 周视图 ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 2 }}>
        <button onClick={() => chWeek(-1)} style={{ ...btnS, flex: '0 0 auto', padding: '4px 6px', fontSize: '.75rem' }}>◀</button>
        <div style={{ display: 'flex', justifyContent: 'space-around', flex: 1, background: '#fff', borderRadius: 10, border: '1px solid var(--border)', padding: '6px 2px' }}>
          {weekDays.map(d => (
            <button key={d.ds} onClick={() => setDate(d.ds)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0', borderRadius: 8, border: d.isToday ? '2px solid var(--primary)' : '2px solid transparent', cursor: 'pointer', minWidth: 34, background: d.ds === date ? 'var(--primary)' : 'transparent', color: d.ds === date ? '#fff' : d.isToday ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: d.ds === date ? 600 : 400 }}>
              <span style={{ fontSize: '.65rem' }}>{d.label}</span>
              <span style={{ fontSize: '.9rem', fontWeight: d.ds === date ? 700 : 500 }}>{parseDate(d.ds).getDate()}</span>
            </button>
          ))}
        </div>
        <button onClick={() => chWeek(1)} style={{ ...btnS, flex: '0 0 auto', padding: '4px 6px', fontSize: '.75rem' }}>▶</button>
      </div>

      <div style={{ textAlign: 'center', padding: '8px 0 4px', fontSize: '.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
        {fmtDate(date)}
        {date === today && <span style={{ marginLeft: 6, padding: '2px 10px', borderRadius: 10, background: 'var(--primary)', color: '#fff', fontSize: '.75rem', fontWeight: 600, letterSpacing: '.5px' }}>今天</span>}
      </div>

      {/* ═══ 计时器 ═══ */}
      {date === today && (
        <div style={{ textAlign: 'center', padding: '6px 14px 10px' }}>
          {savedSec > 0 && timerState === 'idle' && (
            <div style={{ fontSize: '.8rem', color: 'var(--green)', fontWeight: 500, marginBottom: 4 }}>
              ✅ 今日已练 {fmtDuration(savedSec)}
              <button onClick={() => setDelConfirm({ type: 'duration' })} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '.7rem', marginLeft: 4, padding: 0 }}>✕</button>
            </div>
          )}
          {timerState === 'idle' && (
            <button onClick={startTimer} className="btn btn-primary btn-sm"
              style={{ fontSize: '.85rem', padding: '8px 28px', borderRadius: 20 }}>
              ▶ 开始训练
            </button>
          )}
          {timerState !== 'idle' && (
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginBottom: 6, color: timerState === 'paused' ? '#f59e0b' : 'var(--primary)' }}>
                {fmtDuration(elapsedSec)}
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                {timerState === 'running' ? (
                  <button onClick={pauseTimer} className="btn btn-secondary btn-sm" style={{ borderRadius: 20, padding: '6px 20px' }}>⏸ 暂停</button>
                ) : (
                  <>
                    <button onClick={resumeTimer} className="btn btn-primary btn-sm" style={{ borderRadius: 20, padding: '6px 20px' }}>▶ 继续</button>
                    <button onClick={stopTimer} className="btn btn-danger btn-sm" style={{ borderRadius: 20, padding: '6px 20px' }}>⏹ 结束</button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ 内容 ═══ */}
      <div style={{ minHeight: 200 }}>
        {loading ? <div className="loading-spinner"><div className="spin" />加载中...</div>
          : records.length === 0 ? (
            <div style={{ padding: '16px 0' }}>
              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: '2.2rem', marginBottom: 6 }}>💪</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>这天还没安排训练</p>
              </div>
              {recentDays.length > 0 && (
                <div>
                  <p style={{ fontSize: '.75rem', color: '#94a3b8', marginBottom: 8, textAlign: 'center' }}>📋 复用之前的训练计划</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {recentDays.map(plan => (
                      <button
                        key={plan.date}
                        onClick={() => copyDay(plan)}
                        disabled={copying === plan.date}
                        style={{
                          background: '#fff', border: '1px solid var(--border)', borderRadius: 10,
                          padding: '10px 14px', textAlign: 'left', cursor: 'pointer', width: '100%',
                          opacity: copying && copying !== plan.date ? 0.5 : 1,
                        }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: '.82rem', fontWeight: 600 }}>
                            {plan.date === todayStr() ? '🟢 ' : ''}{plan.label}
                          </span>
                          <span style={{ fontSize: '.7rem', color: 'var(--primary)', fontWeight: 500 }}>
                            {copying === plan.date ? '复制中...' : '复用 →'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {plan.exercises.map((ex, i) => (
                            <span key={i} style={{
                              padding: '2px 8px', borderRadius: 12, background: '#f1f5f9',
                              fontSize: '.7rem', color: '#64748b', whiteSpace: 'nowrap',
                            }}>
                              {ex.name}{ex.sets > 0 ? ` ${ex.sets}组` : ''}{ex.reps > 0 ? `×${ex.reps}` : ''}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : records.map(r => <ExerciseCard key={r.id} record={r} onUpdate={handleUpdate} onDelete={handleDelete} />)}
      </div>

      {/* 触底占位：保证空白区域可触摸滑动 */}
      <div style={{ height: 80, minHeight: 'calc(100dvh - 380px)' }} />

      {/* 照片 */}
      {!loading && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>📸 训练照片 {photos.length > 0 && `(${photos.length})`}</span>
            <button className="btn btn-sm btn-secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? '上传中...' : '📷 拍照/相册'}</button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />
          {photos.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {photos.map(p => <div key={p.id} onClick={() => setViewing(p)} style={{ aspectRatio: '1', borderRadius: 8, overflow: 'hidden', cursor: 'pointer', border: '1px solid var(--border)' }}><img src={`/${p.file_path}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} /></div>)}
            </div>
          ) : <div style={{ textAlign: 'center', padding: '16px 0', color: '#94a3b8', fontSize: '.75rem', border: '1px dashed var(--border)', borderRadius: 8 }}>训练完拍照记录体态</div>}
        </div>
      )}

      {/* 照片大图 */}
      {viewing && <div className="modal-overlay" onClick={() => setViewing(null)} onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, padding: 16 }}><img src={`/${viewing.file_path}`} alt="" style={{ width: '100%', borderRadius: 8, maxHeight: '60vh', objectFit: 'contain' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} /><div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: '.8rem', color: 'var(--text-secondary)' }}><span>{viewing.date} · {viewing.view_type}</span><button className="btn btn-danger btn-sm" onClick={() => delPhoto(viewing.id)}>删除</button></div></div></div>}

      {/* ＋ */}
      <button onClick={() => { setForm({ name: '', sets: '', reps: '', wt: '', pd: date }); setShowForm(true) }} style={{ position: 'fixed', bottom: 80, right: 20, width: 52, height: 52, borderRadius: '50%', background: 'var(--primary)', color: '#fff', border: 'none', fontSize: '1.6rem', cursor: 'pointer', boxShadow: '0 4px 16px rgba(79,70,229,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>＋</button>

      {/* 添加弹窗 */}
      {showForm && <div className="modal-overlay" onClick={() => setShowForm(false)} onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}><form className="modal" onClick={e => e.stopPropagation()} onSubmit={submit} style={{ maxWidth: 360, padding: 20 }}><h2 style={{ fontSize: '1.05rem', marginBottom: 14 }}>添加训练动作</h2>
        <div className="form-group"><label>动作名称</label><input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="如：卧推、深蹲" autoFocus /></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4, alignItems: 'center' }}>
          {myEx.map(ex => <button key={ex} type="button" onClick={() => setForm({ ...form, name: ex })} style={{ padding: '4px 10px', borderRadius: 16, border: '1px solid #e2e8f0', background: form.name === ex ? 'var(--primary)' : '#fff', color: form.name === ex ? '#fff' : '#64748b', fontSize: '.75rem', cursor: 'pointer' }}>{ex}</button>)}
          <button type="button" onClick={() => setEditingEx(true)} style={{ padding: '4px 8px', borderRadius: 16, border: '1px dashed #cbd5e1', background: '#fff', color: '#94a3b8', fontSize: '.72rem', cursor: 'pointer' }}>✎ 编辑</button>
        </div>
        {recentCfg.length > 0 && <div style={{ marginBottom: 8 }}><div style={{ fontSize: '.72rem', color: '#94a3b8', marginBottom: 4 }}>📋 历史记录（点一下填入）</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{recentCfg.map((c, i) => <button key={i} type="button" onClick={() => setForm({ ...form, name: c.name, sets: String(c.sets || ''), reps: String(c.reps || ''), wt: c.wt ? String(c.wt) : '' })} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '.72rem', cursor: 'pointer', textAlign: 'left', lineHeight: 1.3 }}><div style={{ fontWeight: 500 }}>{c.name}</div><div style={{ color: '#94a3b8', fontSize: '.68rem' }}>{c.sets > 0 ? `${c.sets}组` : ''}{c.reps > 0 ? ` ×${c.reps}` : ''}{c.wt ? ` ${c.wt}kg` : ''}</div></button>)}</div></div>}
        <div className="form-group" style={{ marginTop: 8 }}><label>训练日期</label><input className="form-input" type="date" value={form.pd} onChange={e => setForm({ ...form, pd: e.target.value })} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <div className="form-group"><label>组数</label><input className="form-input" type="number" min={0} placeholder="0" value={form.sets} onChange={e => setForm({ ...form, sets: e.target.value })} /></div>
          <div className="form-group"><label>次数/组</label><input className="form-input" type="number" min={0} placeholder="0" value={form.reps} onChange={e => setForm({ ...form, reps: e.target.value })} /></div>
          <div className="form-group"><label>重量 kg</label><input className="form-input" type="text" inputMode="decimal" value={form.wt} onChange={e => setForm({ ...form, wt: e.target.value })} placeholder="选填" /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
          <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>取消</button>
          <button type="submit" className="btn btn-primary" disabled={!form.name.trim()}>保存</button>
        </div>
      </form></div>}

      {/* 编辑动作弹窗 */}
      {editingEx && <div className="modal-overlay" onClick={() => setEditingEx(false)} onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360, padding: 20 }}><h2 style={{ fontSize: '1.05rem', marginBottom: 14 }}>编辑常用动作</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}><input className="form-input" value={newEx} onChange={e => setNewEx(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEx() } }} placeholder="新动作名称" style={{ flex: 1 }} /><button type="button" className="btn btn-primary btn-sm" onClick={addEx}>添加</button></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>{myEx.map(ex => <span key={ex} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px 4px 12px', borderRadius: 16, background: '#f1f5f9', fontSize: '.8rem' }}>{ex}<button type="button" onClick={() => rmEx(ex)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1rem', padding: '0 2px', lineHeight: 1 }}>×</button></span>)}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}><button type="button" className="btn btn-sm btn-secondary" onClick={() => { setMyEx([...DEF_EX]); saveMyEx([...DEF_EX]) }} style={{ fontSize: '.72rem' }}>恢复默认</button><button type="button" className="btn btn-primary btn-sm" onClick={() => setEditingEx(false)}>完成</button></div>
      </div></div>}
      {/* 确认删除时长弹窗 */}
      {delConfirm && (
        <div className="modal-overlay" onClick={() => setDelConfirm(null)} style={{ alignItems: 'center' }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 300, padding: 24, textAlign: 'center', borderRadius: 16, margin: '0 16px' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>⏱️</div>
            <p style={{ fontSize: '.92rem', fontWeight: 600, marginBottom: 4 }}>删除今日训练时长？</p>
            <p style={{ fontSize: '.78rem', color: 'var(--text-secondary)', marginBottom: 20 }}>删除后可在统计中重新记录</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setDelConfirm(null)} style={{ padding: '8px 24px' }}>取消</button>
              <button className="btn btn-danger" onClick={async () => {
                setDelConfirm(null)
                try { await fetch(BASE + '/sessions/' + todayStr(), { method: 'DELETE', headers: getHeaders() }); setSavedSec(0) } catch {}
              }} style={{ padding: '8px 24px' }}>删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const btnS: React.CSSProperties = { background: '#fff', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--text)' }
