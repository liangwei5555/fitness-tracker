import { useEffect, useState, useRef } from 'react'
import { workoutApi, photoApi, type WorkoutRecord, type DailyPhoto } from '../api'
import ExerciseCard from '../components/ExerciseCard'

// ─── 日期工具 ───
function pad2(n: number): string { return n < 10 ? `0${n}` : `${n}` }
function dateStr(y: number, m: number, d: number): string { return `${y}-${pad2(m + 1)}-${pad2(d)}` }
function todayStr(): string { const d = new Date(); return dateStr(d.getFullYear(), d.getMonth(), d.getDate()) }
function parseDate(s: string): Date { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
function addDays(ds: string, n: number): string { const d = parseDate(ds); d.setDate(d.getDate() + n); return dateStr(d.getFullYear(), d.getMonth(), d.getDate()) }

const WD = ['日', '一', '二', '三', '四', '五', '六']

function fmtDateFull(d: string): string {
  const dt = parseDate(d)
  return `${dt.getMonth() + 1}月${dt.getDate()}日 周${WD[dt.getDay()]}`
}

function weekMonday(ds: string): string {
  const d = parseDate(ds)
  const dow = d.getDay() || 7
  d.setDate(d.getDate() - dow + 1)
  return dateStr(d.getFullYear(), d.getMonth(), d.getDate())
}

const DEFAULT_EXERCISES = ['卧推', '深蹲', '硬拉', '引体向上', '哑铃飞鸟', '弯举', '推举', '划船', '俯卧撑', '卷腹']

function loadMyExercises(): string[] {
  try { const r = localStorage.getItem('my_exercises'); if (r) { const a = JSON.parse(r); if (Array.isArray(a) && a.length) return a } } catch {}
  return [...DEFAULT_EXERCISES]
}
function saveMyExercises(l: string[]) { localStorage.setItem('my_exercises', JSON.stringify(l)) }

export default function TodayWorkout() {
  const today = todayStr()
  const [date, setDate] = useState(today)
  const [records, setRecords] = useState<WorkoutRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ exercise_name: '', target_sets: '', reps: '', weight_kg: '', plan_date: date })
  const [photos, setPhotos] = useState<DailyPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const [viewing, setViewing] = useState<DailyPhoto | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [myExercises, setMyExercises] = useState<string[]>(loadMyExercises)
  const [editingExercises, setEditingExercises] = useState(false)
  const [newExercise, setNewExercise] = useState('')

  // 历史配置
  interface ExConfig { name: string; sets: number; reps: number; weight: number | null }
  const [recentConfigs, setRecentConfigs] = useState<ExConfig[]>([])
  const [lastWorkoutDate, setLastWorkoutDate] = useState<string | null>(null)
  const [lastWorkoutRecords, setLastWorkoutRecords] = useState<WorkoutRecord[]>([])
  const [copying, setCopying] = useState(false)

  // 周视图基点（独立于当前选中日期）
  const [weekBase, setWeekBase] = useState(weekMonday(today))

  // ═══ 滑动 ═══
  const touchStartX = useRef(0)
  const dateOnStart = useRef(date)
  const dateRef = useRef(date); dateRef.current = date

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    dateOnStart.current = dateRef.current
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) < 40) return
    setDate(addDays(dateOnStart.current, dx > 0 ? -1 : 1))
  }

  // ═══ 数据 ═══
  const load = () => {
    setLoading(true)
    workoutApi.list({ date_from: date, date_to: date, page_size: '200' })
      .then(r => setRecords(r.data || [])).catch(() => {}).finally(() => setLoading(false))
    photoApi.list({ date_from: date, date_to: date })
      .then(r => setPhotos(r.data || [])).catch(() => {})
  }
  const loadHistory = () => {
    const to = todayStr(); const from = addDays(to, -60)
    workoutApi.list({ date_from: from, date_to: to, page_size: '500' }).then(r => {
      const recs = r.data || []
      const seen = new Set<string>(); const configs: ExConfig[] = []
      for (const rec of recs) {
        const k = `${rec.exercise_name}|${rec.target_sets || rec.sets}|${rec.reps}|${rec.weight_kg ?? 0}`
        if (!seen.has(k) && rec.exercise_name) { seen.add(k); configs.push({ name: rec.exercise_name, sets: rec.target_sets || rec.sets || 0, reps: rec.reps || 0, weight: rec.weight_kg }) }
      }
      setRecentConfigs(configs.slice(0, 20))
      const dates = [...new Set(recs.map(r => r.date))].sort().reverse()
      const ld = dates.find(d => d !== to) || null
      if (ld) { setLastWorkoutDate(ld); setLastWorkoutRecords(recs.filter(r => r.date === ld)) }
    }).catch(() => {})
  }
  useEffect(() => { load() }, [date])
  useEffect(() => { loadHistory() }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.exercise_name.trim()) return
    try {
      await workoutApi.create({ date: form.plan_date, exercise_name: form.exercise_name.trim(), target_sets: Number(form.target_sets) || 0, reps: Number(form.reps) || 0, weight_kg: form.weight_kg ? Number(form.weight_kg) : null })
      setShowForm(false); load(); loadHistory()
    } catch {}
  }

  const handleUpdate = (r: WorkoutRecord) => setRecords(prev => prev.map(p => p.id === r.id ? r : p))
  const handleDelete = async (id: number) => { try { await workoutApi.delete(id); load() } catch {} }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setUploading(true)
    try { await photoApi.upload(f, date); load() } catch { alert('上传失败') }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }
  const handlePhotoDelete = async (id: number) => {
    if (!window.confirm('删除？')) return
    try { await photoApi.delete(id); load(); setViewing(null) } catch {}
  }
  const copyLastWorkout = async () => {
    if (!lastWorkoutRecords.length) return; setCopying(true)
    try { for (const rec of lastWorkoutRecords) { await workoutApi.create({ date, exercise_name: rec.exercise_name, target_sets: rec.target_sets || rec.sets || 0, reps: rec.reps || 0, weight_kg: rec.weight_kg }) }; load() } catch {} finally { setCopying(false) }
  }

  const addEx = () => { const n = newExercise.trim(); if (!n || myExercises.includes(n)) return; const u = [...myExercises, n]; setMyExercises(u); saveMyExercises(u); setNewExercise('') }
  const rmEx = (n: string) => { const u = myExercises.filter(e => e !== n); setMyExercises(u); saveMyExercises(u) }

  // ═══ 周视图 ═══
  const weekDays: { label: string; ds: string; isToday: boolean }[] = []
  for (let i = 0; i < 7; i++) {
    const ds = addDays(weekBase, i)
    weekDays.push({ label: WD[parseDate(ds).getDay()], ds, isToday: ds === today })
  }

  const changeWeek = (n: number) => setWeekBase(addDays(weekBase, n * 7))

  return (
    <div style={{ paddingBottom: 20 }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* ═══ 周视图条 ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
        <button onClick={() => changeWeek(-1)} style={{ ...btnSmall, flex: '0 0 auto', padding: '4px 6px', fontSize: '.75rem' }}>◀</button>
        <div style={{ display: 'flex', justifyContent: 'space-around', flex: 1, background: '#fff', borderRadius: 10, border: '1px solid var(--border)', padding: '6px 2px' }}>
          {weekDays.map(d => (
            <button key={d.ds} onClick={() => setDate(d.ds)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0', borderRadius: 8, border: 'none', cursor: 'pointer', minWidth: 34, background: d.ds === date ? 'var(--primary)' : 'transparent', color: d.ds === date ? '#fff' : d.isToday ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: d.ds === date ? 600 : 400 }}>
              <span style={{ fontSize: '.65rem' }}>{d.label}</span>
              <span style={{ fontSize: '.9rem', fontWeight: d.ds === date ? 700 : 500 }}>{parseDate(d.ds).getDate()}</span>
            </button>
          ))}
        </div>
        <button onClick={() => changeWeek(1)} style={{ ...btnSmall, flex: '0 0 auto', padding: '4px 6px', fontSize: '.75rem' }}>▶</button>
      </div>

      {/* 日期标题 */}
      <div style={{ textAlign: 'center', padding: '8px 0 4px', fontSize: '.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
        {fmtDateFull(date)}
        <span style={{ fontSize: '.7rem', color: '#94a3b8', marginLeft: 8 }}>← 滑动切换 →</span>
      </div>

      {/* ═══ 内容 ═══ */}
      {loading ? <div className="loading-spinner"><div className="spin" />加载中...</div>
        : records.length === 0 ? (
          <div className="empty-state" style={{ padding: 28 }}>
            <div style={{ fontSize: '2.2rem', marginBottom: 6 }}>💪</div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>这天还没安排训练</p>
            {lastWorkoutDate && lastWorkoutRecords.length > 0 && (
              <button className="btn btn-sm btn-secondary" onClick={copyLastWorkout} disabled={copying} style={{ fontSize: '.78rem' }}>
                {copying ? '复制中...' : `📋 复用 ${lastWorkoutDate} 的计划`}
              </button>
            )}
          </div>
        ) : records.map(r => <ExerciseCard key={r.id} record={r} onUpdate={handleUpdate} onDelete={handleDelete} />)}

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
              {photos.map(p => <div key={p.id} onClick={() => setViewing(p)} style={{ aspectRatio: '1', borderRadius: 8, overflow: 'hidden', cursor: 'pointer', border: '1px solid var(--border)' }}><img src={`/${p.file_path}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>)}
            </div>
          ) : <div style={{ textAlign: 'center', padding: '16px 0', color: '#94a3b8', fontSize: '.75rem', border: '1px dashed var(--border)', borderRadius: 8 }}>训练完拍照记录体态</div>}
        </div>
      )}

      {/* 照片大图 */}
      {viewing && <div className="modal-overlay" onClick={() => setViewing(null)}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, padding: 16 }}><img src={`/${viewing.file_path}`} alt="" style={{ width: '100%', borderRadius: 8, maxHeight: '60vh', objectFit: 'contain' }} /><div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: '.8rem', color: 'var(--text-secondary)' }}><span>{viewing.date} · {viewing.view_type}</span><button className="btn btn-danger btn-sm" onClick={() => handlePhotoDelete(viewing.id)}>删除</button></div></div></div>}

      {/* ＋ */}
      <button onClick={() => { setForm({ exercise_name: '', target_sets: '', reps: '', weight_kg: '', plan_date: date }); setShowForm(true) }} style={{ position: 'fixed', bottom: 80, right: 20, width: 52, height: 52, borderRadius: '50%', background: 'var(--primary)', color: '#fff', border: 'none', fontSize: '1.6rem', cursor: 'pointer', boxShadow: '0 4px 16px rgba(79,70,229,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>＋</button>

      {/* 添加弹窗 */}
      {showForm && <div className="modal-overlay" onClick={() => setShowForm(false)}><form className="modal" onClick={e => e.stopPropagation()} onSubmit={submit} style={{ maxWidth: 360, padding: 20 }}><h2 style={{ fontSize: '1.05rem', marginBottom: 14 }}>添加训练动作</h2>
        <div className="form-group"><label>动作名称</label><input className="form-input" value={form.exercise_name} onChange={e => setForm({ ...form, exercise_name: e.target.value })} placeholder="如：卧推、深蹲" autoFocus /></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4, alignItems: 'center' }}>
          {myExercises.map(ex => <button key={ex} type="button" onClick={() => setForm({ ...form, exercise_name: ex })} style={{ padding: '4px 10px', borderRadius: 16, border: '1px solid #e2e8f0', background: form.exercise_name === ex ? 'var(--primary)' : '#fff', color: form.exercise_name === ex ? '#fff' : '#64748b', fontSize: '.75rem', cursor: 'pointer' }}>{ex}</button>)}
          <button type="button" onClick={() => setEditingExercises(true)} style={{ padding: '4px 8px', borderRadius: 16, border: '1px dashed #cbd5e1', background: '#fff', color: '#94a3b8', fontSize: '.72rem', cursor: 'pointer' }}>✎ 编辑</button>
        </div>
        {recentConfigs.length > 0 && <div style={{ marginBottom: 8 }}><div style={{ fontSize: '.72rem', color: '#94a3b8', marginBottom: 4 }}>📋 历史记录</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{recentConfigs.map((c, i) => <button key={i} type="button" onClick={() => setForm({ ...form, exercise_name: c.name, target_sets: String(c.sets || ''), reps: String(c.reps || ''), weight_kg: c.weight ? String(c.weight) : '' })} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '.72rem', cursor: 'pointer', textAlign: 'left', lineHeight: 1.3 }}><div style={{ fontWeight: 500 }}>{c.name}</div><div style={{ color: '#94a3b8', fontSize: '.68rem' }}>{c.sets > 0 ? `${c.sets}组` : ''}{c.reps > 0 ? ` ×${c.reps}` : ''}{c.weight ? ` ${c.weight}kg` : ''}</div></button>)}</div></div>}
        <div className="form-group" style={{ marginTop: 8 }}><label>训练日期</label><input className="form-input" type="date" value={form.plan_date} onChange={e => setForm({ ...form, plan_date: e.target.value })} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <div className="form-group"><label>组数</label><input className="form-input" type="number" min={0} placeholder="0" value={form.target_sets} onChange={e => setForm({ ...form, target_sets: e.target.value })} /></div>
          <div className="form-group"><label>次数/组</label><input className="form-input" type="number" min={0} placeholder="0" value={form.reps} onChange={e => setForm({ ...form, reps: e.target.value })} /></div>
          <div className="form-group"><label>重量 kg</label><input className="form-input" type="text" inputMode="decimal" value={form.weight_kg} onChange={e => setForm({ ...form, weight_kg: e.target.value })} placeholder="选填" /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
          <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>取消</button>
          <button type="submit" className="btn btn-primary" disabled={!form.exercise_name.trim()}>保存</button>
        </div>
      </form></div>}

      {/* 编辑动作弹窗 */}
      {editingExercises && <div className="modal-overlay" onClick={() => setEditingExercises(false)}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360, padding: 20 }}><h2 style={{ fontSize: '1.05rem', marginBottom: 14 }}>编辑常用动作</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}><input className="form-input" value={newExercise} onChange={e => setNewExercise(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEx() } }} placeholder="新动作名称" style={{ flex: 1 }} /><button type="button" className="btn btn-primary btn-sm" onClick={addEx}>添加</button></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>{myExercises.map(ex => <span key={ex} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px 4px 12px', borderRadius: 16, background: '#f1f5f9', fontSize: '.8rem' }}>{ex}<button type="button" onClick={() => rmEx(ex)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1rem', padding: '0 2px', lineHeight: 1 }}>×</button></span>)}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}><button type="button" className="btn btn-sm btn-secondary" onClick={() => { setMyExercises([...DEFAULT_EXERCISES]); saveMyExercises([...DEFAULT_EXERCISES]) }} style={{ fontSize: '.72rem' }}>恢复默认</button><button type="button" className="btn btn-primary btn-sm" onClick={() => setEditingExercises(false)}>完成</button></div>
      </div></div>}
    </div>
  )
}

const btnSmall: React.CSSProperties = { background: '#fff', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--text)' }
