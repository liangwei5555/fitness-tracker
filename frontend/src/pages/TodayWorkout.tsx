import { useEffect, useState, useRef } from 'react'
import { workoutApi, photoApi, type WorkoutRecord, type DailyPhoto } from '../api'
import ExerciseCard from '../components/ExerciseCard'

// ─── 日期工具（用本地时间避免时区问题） ───
function toDateParts(d: Date): [number, number, number] {
  return [d.getFullYear(), d.getMonth(), d.getDate()]
}
function pad2(n: number): string { return n < 10 ? `0${n}` : `${n}` }
function dateStr(y: number, m: number, d: number): string {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`
}
function todayStr(): string {
  const [y, m, d] = toDateParts(new Date())
  return dateStr(y, m, d)
}
function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function addDays(ds: string, n: number): string {
  const d = parseDate(ds)
  d.setDate(d.getDate() + n)
  const [y, m, day] = toDateParts(d)
  return dateStr(y, m, day)
}

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

function fmtDateFull(d: string): string {
  const dt = parseDate(d)
  return `${dt.getMonth() + 1}月${dt.getDate()}日 周${WEEKDAY_LABELS[dt.getDay()]}`
}

function getWeekMonday(ds: string): string {
  const d = parseDate(ds)
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1)
  const [y, m, dayOfMonth] = toDateParts(d)
  return dateStr(y, m, dayOfMonth)
}

const DEFAULT_EXERCISES = ['卧推', '深蹲', '硬拉', '引体向上', '哑铃飞鸟', '弯举', '推举', '划船', '俯卧撑', '卷腹']

function loadMyExercises(): string[] {
  try {
    const raw = localStorage.getItem('my_exercises')
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr) && arr.length > 0) return arr
    }
  } catch { /* ignore */ }
  return [...DEFAULT_EXERCISES]
}
function saveMyExercises(list: string[]) { localStorage.setItem('my_exercises', JSON.stringify(list)) }

export default function TodayWorkout() {
  const today = todayStr()
  const [date, setDate] = useState(today)
  const [records, setRecords] = useState<WorkoutRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    exercise_name: '', target_sets: '', reps: '', weight_kg: '', plan_date: date,
  })
  const [photos, setPhotos] = useState<DailyPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const [viewing, setViewing] = useState<DailyPhoto | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [myExercises, setMyExercises] = useState<string[]>(loadMyExercises)
  const [editingExercises, setEditingExercises] = useState(false)
  const [newExercise, setNewExercise] = useState('')

  // ─── 历史训练配置 ───
  interface ExerciseConfig { name: string; sets: number; reps: number; weight: number | null }
  const [recentConfigs, setRecentConfigs] = useState<ExerciseConfig[]>([])
  const [lastWorkoutDate, setLastWorkoutDate] = useState<string | null>(null)
  const [lastWorkoutRecords, setLastWorkoutRecords] = useState<WorkoutRecord[]>([])
  const [copying, setCopying] = useState(false)

  const loadHistory = () => {
    const to = todayStr()
    const from = addDays(to, -60)
    workoutApi.list({ date_from: from, date_to: to, page_size: '500' })
      .then(r => {
        const records = r.data || []
        // 提取唯一配置
        const seen = new Set<string>()
        const configs: ExerciseConfig[] = []
        for (const rec of records) {
          const key = `${rec.exercise_name}|${rec.target_sets || rec.sets}|${rec.reps}|${rec.weight_kg ?? 0}`
          if (!seen.has(key) && rec.exercise_name) {
            seen.add(key)
            configs.push({
              name: rec.exercise_name,
              sets: rec.target_sets || rec.sets || 0,
              reps: rec.reps || 0,
              weight: rec.weight_kg,
            })
          }
        }
        setRecentConfigs(configs.slice(0, 20))

        // 找最近有训练的一天（不含今天）
        const dates = [...new Set(records.map(r => r.date))].sort().reverse()
        const lastDate = dates.find(d => d !== to) || null
        if (lastDate) {
          setLastWorkoutDate(lastDate)
          setLastWorkoutRecords(records.filter(r => r.date === lastDate))
        }
      })
      .catch(() => {})
  }
  useEffect(() => { loadHistory() }, [])

  // ─── 一键复制最近一天的计划 ───
  const copyLastWorkout = async () => {
    if (lastWorkoutRecords.length === 0) return
    setCopying(true)
    try {
      for (const rec of lastWorkoutRecords) {
        await workoutApi.create({
          date,
          exercise_name: rec.exercise_name,
          target_sets: rec.target_sets || rec.sets || 0,
          reps: rec.reps || 0,
          weight_kg: rec.weight_kg,
        })
      }
      load()
    } catch { /* ignore */ }
    finally { setCopying(false) }
  }

  // ─── 滑动手势（用 ref 避免重渲染干扰） ───
  const swipeStartX = useRef(0)
  const swipeStartY = useRef(0)
  const swipeDateOnStart = useRef(date)
  const dateRef = useRef(date)
  dateRef.current = date

  const onTouchStart = (e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0].clientX
    swipeStartY.current = e.touches[0].clientY
    swipeDateOnStart.current = dateRef.current
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - swipeStartX.current
    const dy = e.changedTouches[0].clientY - swipeStartY.current
    // 只有横向滑动且幅度足够才算
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return
    if (dx > 0) {
      setDate(addDays(swipeDateOnStart.current, -1))
    } else {
      setDate(addDays(swipeDateOnStart.current, 1))
    }
  }

  // ─── 数据加载 ───
  const load = () => {
    setLoading(true)
    workoutApi.list({ date_from: date, date_to: date, page_size: '200' })
      .then(r => setRecords(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
    photoApi.list({ date_from: date, date_to: date })
      .then(r => setPhotos(r.data || []))
      .catch(() => {})
  }
  useEffect(() => { load() }, [date])

  const openForm = () => {
    setForm({ exercise_name: '', target_sets: '', reps: '', weight_kg: '', plan_date: date })
    setShowForm(true)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.exercise_name.trim()) return
    try {
      await workoutApi.create({
        date: form.plan_date,
        exercise_name: form.exercise_name.trim(),
        target_sets: Number(form.target_sets) || 0,
        reps: Number(form.reps) || 0,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
      })
      setShowForm(false)
      load()
      loadHistory()
    } catch { /* ignore */ }
  }

  const handleUpdate = (r: WorkoutRecord) => setRecords(prev => prev.map(p => p.id === r.id ? r : p))
  const handleDelete = async (id: number) => { try { await workoutApi.delete(id); load() } catch { /* ignore */ } }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try { await photoApi.upload(file, date); load() }
    catch { alert('上传失败') }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }
  const handlePhotoDelete = async (id: number) => {
    if (!window.confirm('删除这张照片？')) return
    try { await photoApi.delete(id); load(); setViewing(null) } catch { /* ignore */ }
  }

  const addExercise = () => {
    const name = newExercise.trim()
    if (!name || myExercises.includes(name)) return
    const updated = [...myExercises, name]
    setMyExercises(updated); saveMyExercises(updated); setNewExercise('')
  }
  const removeExercise = (name: string) => {
    const updated = myExercises.filter(e => e !== name)
    setMyExercises(updated); saveMyExercises(updated)
  }
  const resetExercises = () => {
    setMyExercises([...DEFAULT_EXERCISES]); saveMyExercises([...DEFAULT_EXERCISES])
  }

  // ─── 周视图 ───
  const monday = getWeekMonday(date)
  const weekDays: { label: string; dateStr: string; isToday: boolean }[] = []
  for (let i = 0; i < 7; i++) {
    const ds = addDays(monday, i)
    weekDays.push({ label: WEEKDAY_LABELS[parseDate(ds).getDay()], dateStr: ds, isToday: ds === today })
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      {/* ═══ 周视图条 ═══ */}
      <div style={{
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        padding: '8px 4px', marginBottom: 2,
        background: '#fff', borderRadius: 10, border: '1px solid var(--border)',
      }}>
        {weekDays.map(d => (
          <button key={d.dateStr} onClick={() => setDate(d.dateStr)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '6px 0', borderRadius: 10, border: 'none', cursor: 'pointer', minWidth: 36,
              background: d.dateStr === date ? 'var(--primary)' : 'transparent',
              color: d.dateStr === date ? '#fff' : d.isToday ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: d.dateStr === date ? 600 : 400,
              transition: 'all 0.15s',
            }}>
            <span style={{ fontSize: '.68rem' }}>{d.label}</span>
            <span style={{ fontSize: '.95rem', fontWeight: d.dateStr === date ? 700 : 500 }}>
              {parseDate(d.dateStr).getDate()}
            </span>
          </button>
        ))}
      </div>

      {/* ═══ 日期标题 ═══ */}
      <div style={{
        textAlign: 'center', padding: '10px 0 6px',
        fontSize: '.9rem', fontWeight: 600, color: 'var(--text-secondary)',
      }}>
        {fmtDateFull(date)}
      </div>

      {/* ═══ 滑动内容区 ═══ */}
      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
        style={{ touchAction: 'pan-y', minHeight: 200 }}>

        {loading ? (
          <div className="loading-spinner"><div className="spin" />加载中...</div>
        ) : records.length === 0 ? (
          <div className="empty-state" style={{ padding: 32 }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>💪</div>
            <p style={{ color: 'var(--text-secondary)' }}>这天还没安排训练</p>
            <p style={{ fontSize: '.8rem', color: '#94a3b8', marginBottom: 16 }}>点击 ＋ 添加动作</p>
            {lastWorkoutDate && lastWorkoutRecords.length > 0 && (
              <button className="btn btn-secondary btn-sm" onClick={copyLastWorkout} disabled={copying}
                style={{ fontSize: '.8rem' }}>
                {copying ? '复制中...' : `📋 复用 ${lastWorkoutDate} 的训练计划`}
              </button>
            )}
          </div>
        ) : (
          records.map(r => (
            <ExerciseCard key={r.id} record={r} onUpdate={handleUpdate} onDelete={handleDelete} />
          ))
        )}

        {/* ─── 当日照片 ─── */}
        {!loading && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                📸 训练照片 {photos.length > 0 && `(${photos.length})`}
              </span>
              <button className="btn btn-sm btn-secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? '上传中...' : '📷 拍照/相册'}
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />
            {photos.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {photos.map(p => (
                  <div key={p.id} onClick={() => setViewing(p)} style={{
                    aspectRatio: '1', borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                    border: '1px solid var(--border)',
                  }}>
                    <img src={`/${p.file_path}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: '.8rem',
                border: '1px dashed var(--border)', borderRadius: 8,
              }}>训练完可以拍照记录体态变化</div>
            )}
          </div>
        )}
      </div>

      {/* ═══ 照片大图 ═══ */}
      {viewing && (
        <div className="modal-overlay" onClick={() => setViewing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, padding: 16 }}>
            <img src={`/${viewing.file_path}`} alt="" style={{ width: '100%', borderRadius: 8, maxHeight: '60vh', objectFit: 'contain' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: '.85rem', color: 'var(--text-secondary)' }}>
              <span>{viewing.date} · {viewing.view_type}</span>
              <button className="btn btn-danger btn-sm" onClick={() => handlePhotoDelete(viewing.id)}>删除</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ＋ 按钮 ═══ */}
      <button onClick={openForm} style={{
        position: 'fixed', bottom: 80, right: 20,
        width: 52, height: 52, borderRadius: '50%',
        background: 'var(--primary)', color: '#fff',
        border: 'none', fontSize: '1.6rem', cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(79,70,229,0.4)',
        zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
        WebkitTapHighlightColor: 'transparent',
      }}>＋</button>

      {/* ═══ 添加训练弹窗 ═══ */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <form className="modal" onClick={e => e.stopPropagation()} onSubmit={submit} style={{ maxWidth: 360, padding: 20 }}>
            <h2 style={{ fontSize: '1.05rem', marginBottom: 16 }}>添加训练动作</h2>
            <div className="form-group">
              <label>动作名称</label>
              <input className="form-input" value={form.exercise_name}
                onChange={e => setForm({ ...form, exercise_name: e.target.value })} placeholder="如：卧推、深蹲" autoFocus />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4, alignItems: 'center' }}>
              {myExercises.map(ex => (
                <button key={ex} type="button" onClick={() => setForm({ ...form, exercise_name: ex })}
                  style={{
                    padding: '4px 10px', borderRadius: 16, border: '1px solid #e2e8f0',
                    background: form.exercise_name === ex ? 'var(--primary)' : '#fff',
                    color: form.exercise_name === ex ? '#fff' : '#64748b', fontSize: '.78rem', cursor: 'pointer',
                  }}>{ex}</button>
              ))}
              <button type="button" onClick={() => setEditingExercises(true)}
                style={{ padding: '4px 8px', borderRadius: 16, border: '1px dashed #cbd5e1', background: '#fff', color: '#94a3b8', fontSize: '.75rem', cursor: 'pointer' }}>✎ 编辑</button>
            </div>

            {/* ─── 历史配置 ─── */}
            {recentConfigs.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: '.75rem', color: '#94a3b8', marginBottom: 6 }}>📋 历史记录（点一下直接填入）</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {recentConfigs.map((c, i) => (
                    <button key={i} type="button" onClick={() => setForm({
                      ...form,
                      exercise_name: c.name,
                      target_sets: String(c.sets || ''),
                      reps: String(c.reps || ''),
                      weight_kg: c.weight ? String(c.weight) : '',
                    })}
                      style={{
                        padding: '5px 10px', borderRadius: 8, border: '1px solid #e2e8f0',
                        background: form.exercise_name === c.name &&
                          form.target_sets === String(c.sets || '') &&
                          form.weight_kg === (c.weight ? String(c.weight) : '')
                          ? '#eef2ff' : '#f8fafc',
                        fontSize: '.76rem', cursor: 'pointer', textAlign: 'left',
                        lineHeight: 1.4,
                      }}>
                      <div style={{ fontWeight: 500 }}>{c.name}</div>
                      <div style={{ color: '#94a3b8', fontSize: '.7rem' }}>
                        {c.sets > 0 ? `${c.sets}组` : ''}{c.reps > 0 ? ` ×${c.reps}次` : ''}{c.weight ? ` ${c.weight}kg` : ''}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="form-group" style={{ marginTop: 8 }}>
              <label>训练日期</label>
              <input className="form-input" type="date" value={form.plan_date}
                onChange={e => setForm({ ...form, plan_date: e.target.value })} />
            </div>
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <div className="form-group"><label>组数</label><input className="form-input" type="number" min={0} placeholder="0" value={form.target_sets} onChange={e => setForm({ ...form, target_sets: e.target.value })} /></div>
              <div className="form-group"><label>次数/组</label><input className="form-input" type="number" min={0} placeholder="0" value={form.reps} onChange={e => setForm({ ...form, reps: e.target.value })} /></div>
              <div className="form-group"><label>重量 kg</label><input className="form-input" type="text" inputMode="decimal" value={form.weight_kg} onChange={e => setForm({ ...form, weight_kg: e.target.value })} placeholder="选填" /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>取消</button>
              <button type="submit" className="btn btn-primary" disabled={!form.exercise_name.trim()}>保存</button>
            </div>
          </form>
        </div>
      )}

      {/* ═══ 编辑动作弹窗 ═══ */}
      {editingExercises && (
        <div className="modal-overlay" onClick={() => setEditingExercises(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360, padding: 20 }}>
            <h2 style={{ fontSize: '1.05rem', marginBottom: 16 }}>编辑常用动作</h2>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input className="form-input" value={newExercise}
                onChange={e => setNewExercise(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addExercise() } }}
                placeholder="输入新动作名称" style={{ flex: 1 }} />
              <button type="button" className="btn btn-primary btn-sm" onClick={addExercise}>添加</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {myExercises.map(ex => (
                <span key={ex} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px 4px 12px', borderRadius: 16, background: '#f1f5f9', fontSize: '.82rem' }}>
                  {ex}
                  <button type="button" onClick={() => removeExercise(ex)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1rem', padding: '0 2px', lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
              <button type="button" className="btn btn-sm btn-secondary" onClick={resetExercises} style={{ fontSize: '.75rem' }}>恢复默认</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditingExercises(false)}>完成</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
