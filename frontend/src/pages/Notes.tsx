import { useEffect, useState } from 'react'

const BASE = '/api'

function getHeaders() {
  const t = localStorage.getItem('fitness_token')
  return {
    'Content-Type': 'application/json',
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  }
}

interface Note {
  id: number
  title: string
  content: string
  created_at: string
  updated_at: string
}

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([])
  const [selected, setSelected] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)

  // 新建/编辑
  const [editing, setEditing] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(BASE + '/notes/', { headers: getHeaders() })
      if (res.ok) {
        const data = await res.json()
        setNotes(Array.isArray(data) ? data : [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openDetail = async (id: number) => {
    try {
      const res = await fetch(BASE + '/notes/' + id, { headers: getHeaders() })
      if (res.ok) setSelected(await res.json())
    } catch { /* ignore */ }
  }

  const startNew = () => {
    setEditId(null)
    setTitle('')
    setContent('')
    setEditing(true)
  }

  const startEdit = (n: Note) => {
    setEditId(n.id)
    setTitle(n.title)
    setContent(n.content)
    setEditing(true)
    setSelected(null)
  }

  const save = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      const url = editId ? BASE + '/notes/' + editId : BASE + '/notes/'
      const method = editId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify({ title: title.trim(), content }),
      })
      if (res.ok) {
        setEditing(false)
        load()
      }
    } catch { /* ignore */ }
    setSaving(false)
  }

  const del = async (id: number) => {
    if (!confirm('确定删除这条笔记？')) return
    try {
      await fetch(BASE + '/notes/' + id, { method: 'DELETE', headers: getHeaders() })
      setSelected(null)
      load()
    } catch { /* ignore */ }
  }

  // ── 详情页 ──
  if (selected) {
    return (
      <div style={{ paddingBottom: 80 }}>
        <button className="btn btn-secondary btn-sm mb-3" onClick={() => setSelected(null)}>← 返回</button>
        <div className="card">
          <h2 style={{ fontSize: '1.1rem', marginBottom: 8 }}>{selected.title}</h2>
          <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
            {new Date(selected.updated_at).toLocaleString('zh-CN')}
          </div>
          <div style={{ fontSize: '.9rem', lineHeight: 1.7, whiteSpace: 'pre-wrap', color: '#334155' }}>
            {selected.content || '（无内容）'}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => startEdit(selected)}>编辑</button>
            <button className="btn btn-danger btn-sm" onClick={() => del(selected.id)}>删除</button>
          </div>
        </div>
      </div>
    )
  }

  // ── 编辑页 ──
  if (editing) {
    return (
      <div style={{ paddingBottom: 80 }}>
        <button className="btn btn-secondary btn-sm mb-3" onClick={() => setEditing(false)}>← 返回</button>
        <div className="card">
          <div className="form-group">
            <label>标题</label>
            <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="笔记标题" autoFocus />
          </div>
          <div className="form-group">
            <label>内容</label>
            <textarea className="form-input" value={content} onChange={e => setContent(e.target.value)} placeholder="笔记内容..." rows={8} style={{ resize: 'none' }} />
          </div>
          <button className="btn btn-primary" onClick={save} disabled={saving} style={{ width: '100%' }}>
            {saving ? '保存中...' : '保存'}
          </button>
          {editId && (
            <button className="btn btn-danger btn-sm" onClick={() => del(editId)} style={{ width: '100%', marginTop: 8 }}>
              删除
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── 列表页 ──
  if (loading) return <div className="loading-spinner"><div className="spin" />加载中...</div>

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: '.9rem', color: 'var(--text-secondary)' }}>{notes.length} 条笔记</span>
        <button className="btn btn-primary btn-sm" onClick={startNew}>＋ 新建</button>
      </div>

      {notes.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: '2.5rem' }}>📝</div>
          <p style={{ color: 'var(--text-secondary)' }}>还没有笔记，点右上角新建</p>
        </div>
      ) : (
        notes.map(n => (
          <div key={n.id} className="card" onClick={() => openDetail(n.id)} style={{ cursor: 'pointer', marginBottom: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{n.title}</div>
            <div style={{ fontSize: '.78rem', color: 'var(--text-secondary)' }}>
              {new Date(n.updated_at).toLocaleString('zh-CN').slice(0, -3)}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
