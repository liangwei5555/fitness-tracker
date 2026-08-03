import { useEffect, useState, useRef, useCallback } from 'react'
import { workoutApi, photoApi, type WorkoutRecord, type DailyPhoto } from '../api'
import ExerciseCard from '../components/ExerciseCard'

function todayStr() { return new Date().toISOString().slice(0, 10) }

function getWeekMonday(dateStr: string): Date {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay() || 7 // Mon=1..Sun=7
  d.setDate(d.getDate() - day + 1)
  return d
}

function formatWeekday(d: Date): string {
  const days = ['日', '一', '二', '三', '四', '五', '六']
  return days[d.getDay()]
}

function fmtDateFull(d: string): string {
  const dt = new Date(d + 'T00:00:00')
  return `${dt.getMonth() + 1}月${dt.getDate()}日 周${formatWeekday(dt)}`
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

function saveMyExercises(list: string[]) {
  localStorage.setItem('my_exercises', JSON.stringify(list))
}

export default function TodayWorkout() {
  const today = todayStr()
  const [date, setDate] = useState(today)
  const [records, setRecords] = useState<WorkoutRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    exercise_name: '', target_sets: '', reps: '', weight_kg: '', plan_date: date,
  })

  // ─── 照片 ───
  const [photos, setPhotos] = useState<DailyPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const [viewing, setViewing] = useState<DailyPhoto | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ─── 常用动作 ───
  const [myExercises, setMyExercises] = useState<string[]>(loadMyExercises)
  const [editingExercises, setEditingExercises] = useState(false)
  const [newExercise, setNewExercise] = useState('')

  // ─── 滑动手势 ───
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    setIsSwiping(true)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isSwiping) return
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = e.touches[0].clientY - touchStartY.current
    // Only track horizontal swipes (ignore vertical scrolls)
    if (Math.abs(dx) > Math.abs(dy)) {
      setSwipeOffset(dx)
    }
  }, [isSwiping])

  const handleTouchEnd = useCallback(() => {
    setIsSwiping(false)
    const threshold = 60
    if (swipeOffset > threshold) {
      // Swipe right → previous day
      const d = new Date(date + 'T00:00:00')
      d.setDate(d.getDate() - 1)
      setDate(d.toISOString().slice(0, 10))
    } else if (swipeOffset < -threshold) {
      // Swipe left → next day
      const d = new Date(date + 'T00:00:00')
      d.setDate(d.getDate() + 1)
      setDate(d.toISOString().slice(0, 10))
    }
    setSwipeOffset(0)
  }, [swipeOffset, date])

  // ─── 周视图 ───
  const monday = getWeekMonday(date)
  const weekDays: { label: string; dateStr: string; isToday: boolean }[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const ds = d.toISOString().slice(0, 10)
    weekDays.push({
      label: formatWeekday(d),
      dateStr: ds,
      isToday: ds === today,
    })
  }

  // ═══ 数据加载 ═══
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

  const changeDate = (delta: number) => {
    const d = new Date(date + 'T00:00:00')
    d.setDate(d.getDate() + delta)
    setDate(d.toISOString().slice(0, 10))
  }

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
    } catch { /* ignore */ }
  }

  const handleUpdate = (r: WorkoutRecord) => {
    setRecords(prev => prev.map(p => p.id === r.id ? r : p))
  }

  const handleDelete = async (id: number) => {
    try { await workoutApi.delete(id); load() } catch { /* ignore */ }
  }

  // ─── 照片操作 ───
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

  // ─── 常用动作编辑 ───
  const addExercise = () => {
    const name = newExercise.trim()
    if (!name || myExercises.includes(name)) return
    const updated = [...myExercises, name]
    setMyExercises(updated)
    saveMyExercises(updated)
    setNewExercise('')
  }
  const removeExercise = (name: string) => {
    const updated = myExercises.filter(e => e !== name)
    setMyExercises(updated)
    saveMyExercises(updated)
  }
  const resetExercises = () => {
    setMyExercises([...DEFAULT_EXERCISES])
    saveMyExercises([...DEFAULT_EXERCISES])
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
          <button
            key={d.dateStr}
            onClick={() => setDate(d.dateStr)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '6px 0', borderRadius: 10, border: 'none',
              cursor: 'pointer', minWidth: 36,
              background: d.dateStr === date ? 'var(--primary)' : 'transparent',
              color: d.dateStr === date ? '#fff' : d.isToday ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: d.dateStr === date ? 600 : 400,
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: '.68rem' }}>{d.label}</span>
            <span style={{ fontSize: '.95rem', fontWeight: d.dateStr === date ? 700 : 500 }}>
              {new Date(d.dateStr + 'T00:00:00').getDate()}
            </span>
          </button>
        ))}
      </div>

      {/* ═══ 日期标题 + 箭头 ═══ */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 8, padding: '8px 0', marginBottom: 4,
      }}>
        <button onClick={() => changeDate(-1)} style={{
          ...arrowBtnStyle, fontSize: '.8rem', padding: '4px 10px',
        }}>‹</button>
        <div style={{
          textAlign: 'center', fontSize: '.95rem', fontWeight: 600,
          minWidth: 120,
        }}>
          {fmtDateFull(date)}
        </div>
        <button onClick={() => changeDate(1)} style={{
          ...arrowBtnStyle, fontSize: '.8rem', padding: '4px 10px',
        }}>›</button>
      </div>

      {/* ═══ 可滑动内容区 ═══ */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: isSwiping ? `translateX(${swipeOffset}px)` : 'translateX(0)',
          transition: isSwiping ? 'none' : 'transform 0.2s ease',
          touchAction: 'pan-y',
        }}
      >
        {/* Exercise list */}
        {loading ? (
          <div className="loading-spinner"><div className="spin" />加载中...</div>
        ) : records.length === 0 ? (
          <div className="empty-state" style={{ padding: 32 }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>💪</div>
            <p style={{ color: 'var(--text-secondary)' }}>这天还没安排训练</p>
            <p style={{ fontSize: '.8rem', color: '#94a3b8' }}>点击 ＋ 添加动作</p>
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
              }}>
                训练完可以拍照记录体态变化
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ 照片大图查看 ═══ */}
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

      {/* ═══ Add button ═══ */}
      <button onClick={openForm} style={{
        position: 'fixed', bottom: 80, right: 20,
        width: 52, height: 52, borderRadius: '50%',
        background: 'var(--primary)', color: '#fff',
        border: 'none', fontSize: '1.6rem', cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(79,70,229,0.4)',
        zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
        WebkitTapHighlightColor: 'transparent',
      }}>＋</button>

      {/* ═══ Add form modal ═══ */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <form className="modal" onClick={e => e.stopPropagation()} onSubmit={submit}
            style={{ maxWidth: 360, padding: 20 }}>
            <h2 style={{ fontSize: '1.05rem', marginBottom: 16 }}>添加训练动作</h2>

            <div className="form-group">
              <label>动作名称</label>
              <input className="form-input" value={form.exercise_name}
                onChange={e => setForm({ ...form, exercise_name: e.target.value })}
                placeholder="如：卧推、深蹲" autoFocus />
            </div>

            {/* Quick pick */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4, alignItems: 'center' }}>
              {myExercises.map(ex => (
                <button key={ex} type="button" onClick={() => setForm({ ...form, exercise_name: ex })}
                  style={{
                    padding: '4px 10px', borderRadius: 16, border: '1px solid #e2e8f0',
                    background: form.exercise_name === ex ? 'var(--primary)' : '#fff',
                    color: form.exercise_name === ex ? '#fff' : '#64748b',
                    fontSize: '.78rem', cursor: 'pointer',
                  }}>{ex}</button>
              ))}
              <button type="button" onClick={() => setEditingExercises(true)}
                style={{
                  padding: '4px 8px', borderRadius: 16, border: '1px dashed #cbd5e1',
                  background: '#fff', color: '#94a3b8', fontSize: '.75rem', cursor: 'pointer',
                }}>✎ 编辑</button>
            </div>

            {/* Date picker */}
            <div className="form-group" style={{ marginTop: 12 }}>
              <label>训练日期</label>
              <input className="form-input" type="date" value={form.plan_date}
                onChange={e => setForm({ ...form, plan_date: e.target.value })} />
            </div>

            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <div className="form-group">
                <label>组数</label>
                <input className="form-input" type="number" min={0} placeholder="0"
                  value={form.target_sets}
                  onChange={e => setForm({ ...form, target_sets: e.target.value })} />
              </div>
              <div className="form-group">
                <label>次数/组</label>
                <input className="form-input" type="number" min={0} placeholder="0"
                  value={form.reps}
                  onChange={e => setForm({ ...form, reps: e.target.value })} />
              </div>
              <div className="form-group">
                <label>重量 kg</label>
                <input className="form-input" type="text" inputMode="decimal"
                  value={form.weight_kg}
                  onChange={e => setForm({ ...form, weight_kg: e.target.value })}
                  placeholder="选填" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>取消</button>
              <button type="submit" className="btn btn-primary" disabled={!form.exercise_name.trim()}>保存</button>
            </div>
          </form>
        </div>
      )}

      {/* ═══ Edit exercises modal ═══ */}
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
                <span key={ex} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '4px 8px 4px 12px', borderRadius: 16,
                  background: '#f1f5f9', fontSize: '.82rem',
                }}>
                  {ex}
                  <button type="button" onClick={() => removeExercise(ex)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#94a3b8', fontSize: '1rem', padding: '0 2px', lineHeight: 1,
                    }}>×</button>
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
              <button type="button" className="btn btn-sm btn-secondary" onClick={resetExercises}
                style={{ fontSize: '.75rem' }}>恢复默认</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditingExercises(false)}>完成</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const arrowBtnStyle: React.CSSProperties = {
  background: '#fff', border: '1px solid var(--border)', borderRadius: 8,
  padding: '6px 14px', fontSize: '.9rem', cursor: 'pointer', color: 'var(--text)',
}
