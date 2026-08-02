import { useEffect, useState } from 'react'
import { workoutApi, type WorkoutRecord } from '../api'

export default function Workouts() {
  const [records, setRecords] = useState<WorkoutRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({ date: today(), exercise_name: '', sets: 3, reps: 12, weight_kg: '', notes: '' })
  const [filterName, setFilterName] = useState('')

  const load = () => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (filterName) params.exercise_name = filterName
    workoutApi.list(params)
      .then(r => setRecords(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filterName])

  const resetForm = () => {
    setForm({ date: today(), exercise_name: '', sets: 3, reps: 12, weight_kg: '', notes: '' })
    setEditId(null)
    setShowForm(false)
  }

  const submit = async () => {
    const payload = {
      date: form.date,
      exercise_name: form.exercise_name,
      sets: form.sets,
      reps: form.reps,
      weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
      notes: form.notes || null,
    }
    try {
      if (editId) {
        await workoutApi.update(editId, payload)
      } else {
        await workoutApi.create(payload)
      }
      resetForm()
      load()
    } catch (e: any) {
      alert(e.message)
    }
  }

  const edit = (r: WorkoutRecord) => {
    setForm({
      date: r.date,
      exercise_name: r.exercise_name,
      sets: r.sets,
      reps: r.reps,
      weight_kg: r.weight_kg?.toString() || '',
      notes: r.notes || '',
    })
    setEditId(r.id)
    setShowForm(true)
  }

  const del = async (id: number) => {
    if (!confirm('确定删除？')) return
    await workoutApi.delete(id)
    load()
  }

  if (loading) return <div className="loading-spinner"><div className="spin" />加载中...</div>
  if (error) return <div className="error-state">⚠ {error}</div>

  // 按日期分组
  const grouped: Record<string, WorkoutRecord[]> = {}
  records.forEach(r => {
    (grouped[r.date] ??= []).push(r)
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <div className="flex gap-2 items-center">
          <input
            placeholder="🔍 搜索动作..."
            value={filterName}
            onChange={e => setFilterName(e.target.value)}
            style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 8, width: 200 }}
          />
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true) }}>➕ 记录训练</button>
      </div>

      {/* 表单弹窗 */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && resetForm()}>
          <div className="modal">
            <h2>{editId ? '编辑训练' : '新增训练'}</h2>
            <div className="form-group"><label>日期</label><input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
            <div className="form-group"><label>动作名称 *</label><input value={form.exercise_name} onChange={e => setForm({...form, exercise_name: e.target.value})} placeholder="如：卧推、深蹲、引体向上" /></div>
            <div className="form-row">
              <div className="form-group"><label>组数</label><input type="number" value={form.sets} onChange={e => setForm({...form, sets: Number(e.target.value)})} /></div>
              <div className="form-group"><label>次数/组</label><input type="number" value={form.reps} onChange={e => setForm({...form, reps: Number(e.target.value)})} /></div>
              <div className="form-group"><label>重量(kg)</label><input value={form.weight_kg} onChange={e => setForm({...form, weight_kg: e.target.value})} placeholder="选填" /></div>
            </div>
            <div className="form-group"><label>备注</label><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="感受、注意事项..." /></div>
            <div className="flex gap-2 justify-between">
              <button className="btn btn-secondary" onClick={resetForm}>取消</button>
              <button className="btn btn-primary" onClick={submit} disabled={!form.exercise_name}>保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 按日期分组显示 */}
      {Object.keys(grouped).length === 0 ? (
        <div className="empty-state"><div className="icon">💪</div><p>还没有训练记录，点击上方按钮开始</p></div>
      ) : (
        Object.entries(grouped).map(([date, items]) => {
          const totalSets = items.reduce((s, r) => s + r.sets, 0)
          return (
            <div className="card" key={date}>
              <div className="flex justify-between items-center mb-2">
                <h2 style={{ margin: 0 }}>📅 {date}</h2>
                <span className="text-secondary">{items.length} 个动作 · {totalSets} 组</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>动作</th><th>组数</th><th>次数</th><th>重量(kg)</th><th>备注</th><th>操作</th></tr></thead>
                  <tbody>
                    {items.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 500 }}>{r.exercise_name}</td>
                        <td>{r.sets}</td><td>{r.reps}</td>
                        <td>{r.weight_kg ?? '-'}</td>
                        <td style={{ color: 'var(--text-secondary)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.notes || '-'}</td>
                        <td>
                          <button className="btn btn-sm btn-secondary" onClick={() => edit(r)} style={{ marginRight: 4 }}>编辑</button>
                          <button className="btn btn-sm btn-danger" onClick={() => del(r.id)}>删除</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

function today() { return new Date().toISOString().slice(0, 10) }
