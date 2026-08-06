import { useEffect, useState } from 'react'

const BASE = '/api'

function getHeaders() {
  const t = localStorage.getItem('fitness_token')
  return {
    'Content-Type': 'application/json',
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  }
}

interface DailyNote {
  id: number
  date: string
  mood: string | null
  sleep_hours: number | null
  diet_notes: string | null
  overall_notes: string | null
}

const MOODS = [
  { emoji: '😄', label: '超棒' },
  { emoji: '😊', label: '不错' },
  { emoji: '😐', label: '一般' },
  { emoji: '😔', label: '疲惫' },
  { emoji: '😤', label: '烦躁' },
]

const today = new Date().toISOString().slice(0, 10)

export default function Notes() {
  const [history, setHistory] = useState<DailyNote[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const [mood, setMood] = useState('')
  const [sleepHours, setSleepHours] = useState('')
  const [diet, setDiet] = useState('')
  const [overall, setOverall] = useState('')
  const [saved, setSaved] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      // 加载今天的笔记
      const r1 = await fetch(BASE + '/notes/?date_from=' + today + '&date_to=' + today, {
        headers: getHeaders(),
      })
      if (!r1.ok) throw new Error('error')
      const todayNotes = await r1.json()
      const todays = Array.isArray(todayNotes) ? todayNotes[0] : null

      if (todays) {
        setMood(todays.mood || '')
        setSleepHours(todays.sleep_hours != null ? String(todays.sleep_hours) : '')
        setDiet(todays.diet_notes || '')
        setOverall(todays.overall_notes || '')
      }

      // 加载历史
      const r2 = await fetch(BASE + '/notes/?date_to=' + today, { headers: getHeaders() })
      if (r2.ok) {
        const data = await r2.json()
        setHistory(Array.isArray(data) ? data.filter((n: DailyNote) => n.date !== today) : [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch(BASE + '/notes/', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          date: today,
          mood: mood || null,
          sleep_hours: sleepHours ? Number(sleepHours) : null,
          diet_notes: diet || null,
          overall_notes: overall || null,
        }),
      })
      if (!res.ok) throw new Error('保存失败')
      await res.json()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      load() // 刷新历史
    } catch { /* ignore */ }
    setSaving(false)
  }

  if (loading) return <div className="loading-spinner"><div className="spin" />加载中...</div>

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* 日期 */}
      <div style={{ marginBottom: 14, textAlign: 'center' }}>
        <span style={{ fontSize: '.95rem', fontWeight: 600 }}>📝 {today}</span>
      </div>

      {/* 心情选择 */}
      <div className="card" style={{ marginBottom: 10 }}>
        <label style={{ fontSize: '.82rem', fontWeight: 500, display: 'block', marginBottom: 8 }}>今日心情</label>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-around' }}>
          {MOODS.map(m => (
            <button
              key={m.emoji}
              onClick={() => setMood(mood === m.emoji ? '' : m.emoji)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                padding: '8px 12px', borderRadius: 12, border: mood === m.emoji ? '2px solid var(--primary)' : '2px solid transparent',
                background: mood === m.emoji ? '#eef2ff' : '#f8fafc',
                cursor: 'pointer', fontSize: '1.5rem', fontFamily: 'inherit',
              }}
            >
              {m.emoji}
              <span style={{ fontSize: '.65rem', color: 'var(--text-secondary)' }}>{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 睡眠 */}
      <div className="card" style={{ marginBottom: 10 }}>
        <label style={{ fontSize: '.82rem', fontWeight: 500, display: 'block', marginBottom: 8 }}>💤 睡眠时长（小时）</label>
        <input
          className="form-input"
          type="number"
          step="0.5"
          min="0"
          max="24"
          value={sleepHours}
          onChange={e => setSleepHours(e.target.value)}
          placeholder="如：7.5"
        />
      </div>

      {/* 饮食 */}
      <div className="card" style={{ marginBottom: 10 }}>
        <label style={{ fontSize: '.82rem', fontWeight: 500, display: 'block', marginBottom: 8 }}>🍽️ 饮食记录</label>
        <textarea
          className="form-input"
          value={diet}
          onChange={e => setDiet(e.target.value)}
          placeholder="今天吃了什么..."
          rows={3}
          style={{ resize: 'none' }}
        />
      </div>

      {/* 总体笔记 */}
      <div className="card" style={{ marginBottom: 14 }}>
        <label style={{ fontSize: '.82rem', fontWeight: 500, display: 'block', marginBottom: 8 }}>📋 训练心得 / 其他笔记</label>
        <textarea
          className="form-input"
          value={overall}
          onChange={e => setOverall(e.target.value)}
          placeholder="今天的训练感受、需要改进的地方..."
          rows={4}
          style={{ resize: 'none' }}
        />
      </div>

      {/* 保存按钮 */}
      <button
        className="btn btn-primary"
        onClick={save}
        disabled={saving}
        style={{ width: '100%', padding: 12, marginBottom: 16 }}
      >
        {saving ? '保存中...' : saved ? '✅ 已保存' : '💾 保存笔记'}
      </button>

      {/* 历史记录 */}
      <div style={{ marginBottom: 12 }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setShowHistory(!showHistory)}
          style={{ width: '100%' }}
        >
          {showHistory ? '收起' : '📅'} 历史笔记 ({history.length} 条)
        </button>
      </div>

      {showHistory && (
        <div>
          {history.length === 0 ? (
            <div className="empty-state" style={{ padding: 20 }}>
              <p style={{ color: 'var(--text-secondary)' }}>还没有历史笔记</p>
            </div>
          ) : (
            history.map(n => (
              <div key={n.id} className="card" style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: '.9rem' }}>{n.date}</span>
                  <span>{n.mood || ''}</span>
                </div>
                {n.sleep_hours != null && (
                  <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                    💤 {n.sleep_hours}h
                  </div>
                )}
                {n.diet_notes && (
                  <div style={{ fontSize: '.82rem', marginBottom: 4, color: '#475569', whiteSpace: 'pre-wrap' }}>
                    🍽️ {n.diet_notes}
                  </div>
                )}
                {n.overall_notes && (
                  <div style={{ fontSize: '.82rem', color: '#475569', whiteSpace: 'pre-wrap' }}>
                    📋 {n.overall_notes}
                  </div>
                )}
                {!n.mood && !n.sleep_hours && !n.diet_notes && !n.overall_notes && (
                  <span style={{ color: 'var(--text-secondary)', fontSize: '.8rem' }}>无内容</span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
