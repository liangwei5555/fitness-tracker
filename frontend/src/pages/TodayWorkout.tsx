import { useEffect, useState } from 'react'
import { workoutApi, type WorkoutRecord } from '../api'
import ExerciseCard from '../components/ExerciseCard'

function todayStr() { return new Date().toISOString().slice(0, 10) }
function fmtDate(d: string) {
  const dt = new Date(d + 'T00:00:00')
  const now = new Date(); const today = now.toISOString().slice(0, 10)
  if (d === today) return '今天'
  const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10)
  if (d === yesterday) return '昨天'
  const tomorrow = new Date(now.getTime() + 86400000).toISOString().slice(0, 10)
  if (d === tomorrow) return '明天'
  return `${dt.getMonth() + 1}月${dt.getDate()}日`
}

export default function TodayWorkout() {
  const [date, setDate] = useState(todayStr())
  const [records, setRecords] = useState<WorkoutRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ exercise_name: '', target_sets: 3, reps: 12, weight_kg: '' })

  const load = () => {
    setLoading(true)
    workoutApi.list({ date_from: date, date_to: date, page_size: '200' })
      .then(r => setRecords(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [date])

  const changeDate = (delta: number) => {
    const d = new Date(date + 'T00:00:00')
    d.setDate(d.getDate() + delta)
    setDate(d.toISOString().slice(0, 10))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.exercise_name.trim()) return
    try {
      await workoutApi.create({
        date, exercise_name: form.exercise_name.trim(),
        target_sets: form.target_sets, reps: form.reps,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
      })
      setForm({ exercise_name: '', target_sets: 3, reps: 12, weight_kg: '' })
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

  const QUICK_EXERCISES = ['卧推', '深蹲', '硬拉', '引体向上', '哑铃飞鸟', '弯举', '推举', '划船', '俯卧撑', '卷腹']

  return (
    <div style={{ paddingBottom: 20 }}>
      {/* Date switcher */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 12, padding: '12px 0', marginBottom: 4,
      }}>
        <button onClick={() => changeDate(-1)} style={arrowBtnStyle}>←</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{fmtDate(date)}</div>
          <div style={{ fontSize: '.78rem', color: 'var(--text-secondary)' }}>{date}</div>
        </div>
        <button onClick={() => changeDate(1)} style={arrowBtnStyle}>→</button>
        <button onClick={() => setDate(todayStr())}
          style={{ ...arrowBtnStyle, fontSize: '.78rem', padding: '6px 12px' }}>
          今天
        </button>
      </div>

      {/* Exercise list */}
      {loading ? (
        <div className="loading-spinner"><div className="spin" />加载中...</div>
      ) : records.length === 0 ? (
        <div className="empty-state" style={{ padding: 32 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>💪</div>
          <p style={{ color: 'var(--text-secondary)' }}>这天还没安排训练</p>
          <p style={{ fontSize: '.8rem', color: '#94a3b8' }}>点击下方按钮添加动作</p>
        </div>
      ) : (
        records.map(r => (
          <ExerciseCard key={r.id} record={r} onUpdate={handleUpdate} onDelete={handleDelete} />
        ))
      )}

      {/* Add button */}
      <button onClick={() => setShowForm(true)} style={{
        position: 'fixed', bottom: 80, right: 20,
        width: 52, height: 52, borderRadius: '50%',
        background: 'var(--primary)', color: '#fff',
        border: 'none', fontSize: '1.6rem', cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(79,70,229,0.4)',
        zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
        WebkitTapHighlightColor: 'transparent',
      }}>＋</button>

      {/* Add form modal */}
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {QUICK_EXERCISES.map(ex => (
                <button key={ex} type="button" onClick={() => setForm({ ...form, exercise_name: ex })}
                  style={{
                    padding: '4px 10px', borderRadius: 16, border: '1px solid #e2e8f0',
                    background: form.exercise_name === ex ? 'var(--primary)' : '#fff',
                    color: form.exercise_name === ex ? '#fff' : '#64748b',
                    fontSize: '.78rem', cursor: 'pointer',
                  }}>{ex}</button>
              ))}
            </div>

            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <div className="form-group">
                <label>组数</label>
                <input className="form-input" type="number" min={1} value={form.target_sets}
                  onChange={e => setForm({ ...form, target_sets: Number(e.target.value) || 1 })} />
              </div>
              <div className="form-group">
                <label>次数/组</label>
                <input className="form-input" type="number" min={1} value={form.reps}
                  onChange={e => setForm({ ...form, reps: Number(e.target.value) || 1 })} />
              </div>
              <div className="form-group">
                <label>重量 kg</label>
                <input className="form-input" type="text" value={form.weight_kg}
                  onChange={e => setForm({ ...form, weight_kg: e.target.value })} placeholder="选填" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>取消</button>
              <button type="submit" className="btn btn-primary" disabled={!form.exercise_name.trim()}>保存</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

const arrowBtnStyle: React.CSSProperties = {
  background: '#fff', border: '1px solid var(--border)', borderRadius: 8,
  padding: '6px 14px', fontSize: '.9rem', cursor: 'pointer', color: 'var(--text)',
}
