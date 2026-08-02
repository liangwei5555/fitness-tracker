import { useEffect, useState } from 'react'
import { goalApi, type ImprovementGoal } from '../api'

export default function Goals() {
  const [goals, setGoals] = useState<ImprovementGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ goal_name: '', target_metric: '', target_value: '', unit: '', description: '' })

  const load = () => {
    goalApi.list()
      .then(r => setGoals(Array.isArray(r) ? r : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.goal_name || !form.target_metric) return
    try {
      await goalApi.create({
        goal_name: form.goal_name,
        target_metric: form.target_metric,
        target_value: Number(form.target_value) || null,
        unit: form.unit || null,
        description: form.description || null,
        started_at: new Date().toISOString().slice(0, 10),
      })
      setForm({ goal_name: '', target_metric: '', target_value: '', unit: '', description: '' })
      setShowForm(false)
      load()
    } catch { /* ignore */ }
  }

  const toggle = async (g: ImprovementGoal) => {
    try { await goalApi.update(g.id, { is_active: !g.is_active }); load() } catch { /* ignore */ }
  }

  const calcPct = (g: ImprovementGoal) => {
    if (!g.initial_value || !g.current_value || !g.target_value) return 0
    return Math.max(0, Math.min(100, Math.round(((g.current_value - g.initial_value) / (g.target_value - g.initial_value)) * 100)))
  }

  if (loading) return <div className="loading-spinner"><div className="spin" />加载中...</div>

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: '.9rem', color: 'var(--text-secondary)' }}>{goals.length} 个目标</span>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>＋ 新建目标</button>
      </div>

      {goals.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: '2.5rem' }}>🎯</div>
          <p style={{ color: 'var(--text-secondary)' }}>还没有改善目标</p>
        </div>
      ) : (
        goals.map(g => {
          const pct = calcPct(g)
          return (
            <div key={g.id} className="card" style={{ opacity: g.is_active ? 1 : 0.5, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 600 }}>{g.goal_name}</span>
                <button className="btn btn-sm btn-secondary" onClick={() => toggle(g)}>
                  {g.is_active ? '暂停' : '恢复'}
                </button>
              </div>
              <div style={{ fontSize: '.82rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                {g.target_metric} · 目标 {g.target_value}{g.unit} · 当前 {g.current_value ?? '-'}{g.unit}
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${pct}%`, background: pct >= 80 ? 'var(--green)' : 'var(--primary)' }} />
              </div>
              <div style={{ fontSize: '.75rem', color: '#94a3b8', marginTop: 4 }}>{pct}%</div>
            </div>
          )
        })
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <form className="modal" onClick={e => e.stopPropagation()} onSubmit={submit} style={{ maxWidth: 360, padding: 20 }}>
            <h2 style={{ fontSize: '1.05rem', marginBottom: 16 }}>新建目标</h2>
            <div className="form-group">
              <label>目标名称</label>
              <input className="form-input" value={form.goal_name} onChange={e => setForm({ ...form, goal_name: e.target.value })} placeholder="如：改善高低肩" autoFocus />
            </div>
            <div className="form-group">
              <label>衡量指标</label>
              <input className="form-input" value={form.target_metric} onChange={e => setForm({ ...form, target_metric: e.target.value })} placeholder="如：肩膀高度差" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="form-group">
                <label>目标值</label>
                <input className="form-input" type="number" value={form.target_value} onChange={e => setForm({ ...form, target_value: e.target.value })} />
              </div>
              <div className="form-group">
                <label>单位</label>
                <input className="form-input" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="cm/kg" />
              </div>
            </div>
            <div className="form-group">
              <label>描述</label>
              <textarea className="form-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="可选" rows={2} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>取消</button>
              <button type="submit" className="btn btn-primary">创建</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
