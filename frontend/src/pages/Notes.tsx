import { useEffect, useState } from 'react'

const BASE = '/api'

function getHeaders() {
  const t = localStorage.getItem('fitness_token')
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) }
}

interface Note {
  id: number; title: string; content: string; created_at: string; updated_at: string
}

const ACCENTS = ['#4f46e5', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#e11d48', '#65a30d']
const CARD_ICONS = ['📋', '💡', '🏋️', '🍽️', '📌', '🔖', '✏️', '📎']

function timeAgo(s: string): string {
  const diff = Date.now() - new Date(s).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} 天前`
  return new Date(s).toLocaleDateString('zh-CN')
}

function contentPreview(s: string, max = 60): string {
  const clean = s.replace(/\s+/g, ' ').trim()
  return clean.length > max ? clean.slice(0, max) + '...' : clean
}

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([])
  const [selected, setSelected] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(BASE + '/notes/', { headers: getHeaders() })
      if (res.ok) { const data = await res.json(); setNotes(Array.isArray(data) ? data : []) }
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

  const startNew = () => { setEditId(null); setTitle(''); setContent(''); setEditing(true) }
  const startEdit = (n: Note) => { setEditId(n.id); setTitle(n.title); setContent(n.content); setEditing(true); setSelected(null) }

  const save = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      const url = editId ? BASE + '/notes/' + editId : BASE + '/notes/'
      const method = editId ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: getHeaders(), body: JSON.stringify({ title: title.trim(), content }) })
      if (res.ok) { setEditing(false); load() }
    } catch { /* ignore */ }
    setSaving(false)
  }

  const del = async (id: number) => {
    if (!confirm('确定删除这条笔记？')) return
    try { await fetch(BASE + '/notes/' + id, { method: 'DELETE', headers: getHeaders() }); setSelected(null); load() } catch { /* ignore */ }
  }

  // ── 详情页 ──
  if (selected) {
    const accent = ACCENTS[selected.id % ACCENTS.length]
    return (
      <div style={{ paddingBottom: 80 }}>
        <button onClick={() => setSelected(null)} style={{
          background: 'none', border: 'none', cursor: 'pointer', fontSize: '.85rem',
          color: 'var(--text-secondary)', padding: '8px 0', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4,
        }}>← 返回笔记列表</button>

        <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {/* 彩色头部 */}
          <div style={{ background: accent, padding: '24px 20px 20px', color: '#fff' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, lineHeight: 1.3 }}>{selected.title}</h2>
            <div style={{ fontSize: '.75rem', opacity: 0.75, marginTop: 8 }}>
              {new Date(selected.updated_at).toLocaleString('zh-CN')}
            </div>
          </div>
          {/* 内容 */}
          <div style={{ padding: '20px' }}>
            <div style={{ fontSize: '.92rem', lineHeight: 1.8, whiteSpace: 'pre-wrap', color: '#334155' }}>
              {selected.content || '（无内容）'}
            </div>
          </div>
          {/* 操作栏 */}
          <div style={{ display: 'flex', gap: 0, borderTop: '1px solid var(--border)' }}>
            <button onClick={() => startEdit(selected)} style={{
              flex: 1, padding: '14px', border: 'none', background: 'none',
              color: 'var(--primary)', fontWeight: 500, fontSize: '.88rem', cursor: 'pointer',
            }}>✏️ 编辑</button>
            <button onClick={() => del(selected.id)} style={{
              flex: 1, padding: '14px', border: 'none', background: 'none',
              color: 'var(--red)', fontWeight: 500, fontSize: '.88rem', cursor: 'pointer',
              borderLeft: '1px solid var(--border)',
            }}>🗑️ 删除</button>
          </div>
        </div>
      </div>
    )
  }

  // ── 编辑页 ──
  if (editing) {
    return (
      <div style={{ paddingBottom: 80 }}>
        <button onClick={() => setEditing(false)} style={{
          background: 'none', border: 'none', cursor: 'pointer', fontSize: '.85rem',
          color: 'var(--text-secondary)', padding: '8px 0', marginBottom: 12,
        }}>← 返回</button>

        <div className="card" style={{ padding: 20, borderRadius: 14 }}>
          <div className="form-group">
            <label style={{ fontWeight: 600, fontSize: '.82rem', marginBottom: 6, display: 'block' }}>📌 标题</label>
            <input className="form-input" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="给笔记起个名字..." autoFocus
              style={{ fontSize: '1rem', padding: '12px 14px', borderRadius: 10 }} />
          </div>
          <div className="form-group">
            <label style={{ fontWeight: 600, fontSize: '.82rem', marginBottom: 6, display: 'block' }}>
              📝 内容 <span style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: '.7rem' }}>{content.length} 字</span>
            </label>
            <textarea className="form-input" value={content} onChange={e => setContent(e.target.value)}
              placeholder="写下你的想法..." rows={10}
              style={{ fontSize: '.92rem', padding: '14px', borderRadius: 10, resize: 'none', lineHeight: 1.7 }} />
          </div>
          <button className="btn btn-primary" onClick={save} disabled={saving || !title.trim()}
            style={{ width: '100%', padding: 14, fontSize: '.95rem', borderRadius: 12, fontWeight: 600 }}>
            {saving ? '⏳ 保存中...' : '💾 保存笔记'}
          </button>
          {editId && (
            <button className="btn btn-danger btn-sm" onClick={() => del(editId)}
              style={{ width: '100%', marginTop: 8, padding: 10, borderRadius: 10 }}>
              🗑️ 删除这条笔记
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
      {/* 头部 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 16, paddingBottom: 12,
      }}>
        <div>
          <span style={{ fontSize: '.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            📝 {notes.length} 条笔记
          </span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={startNew}
          style={{ borderRadius: 20, padding: '8px 20px', fontWeight: 600 }}>
          ＋ 新建笔记
        </button>
      </div>

      {notes.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          background: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)',
          borderRadius: 16,
        }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>📝</div>
          <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: 4, color: 'var(--text)' }}>还没有笔记</p>
          <p style={{ fontSize: '.82rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
            记录训练心得、饮食计划、身体变化...
          </p>
          <button className="btn btn-primary" onClick={startNew}
            style={{ borderRadius: 20, padding: '10px 28px', fontWeight: 600 }}>
            ✨ 写第一条笔记
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {notes.map((n) => {
            const accent = ACCENTS[n.id % ACCENTS.length]
            const icon = CARD_ICONS[n.id % CARD_ICONS.length]
            const hasContent = n.content.trim().length > 0
            return (
              <div key={n.id}
                onClick={() => openDetail(n.id)}
                style={{
                  background: '#fff', borderRadius: 12, cursor: 'pointer',
                  border: '1px solid var(--border)',
                  borderLeft: `3px solid ${accent}`,
                  padding: '16px',
                  transition: 'box-shadow 0.15s, transform 0.15s',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: accent + '18', color: accent,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.1rem', flexShrink: 0,
                  }}>{icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '.92rem', marginBottom: 4, color: 'var(--text)' }}>
                      {n.title}
                    </div>
                    {hasContent && (
                      <div style={{ fontSize: '.78rem', color: '#94a3b8', lineHeight: 1.4, marginBottom: 6 }}>
                        {contentPreview(n.content)}
                      </div>
                    )}
                    <div style={{ fontSize: '.7rem', color: '#c0c8d4' }}>
                      {timeAgo(n.updated_at)}
                    </div>
                  </div>
                  <span style={{ color: '#c0c8d4', fontSize: '.8rem', flexShrink: 0 }}>›</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
