import { useEffect, useState, useRef } from 'react'
import { photoApi, type DailyPhoto } from '../api'

function todayStr() { return new Date().toISOString().slice(0, 10) }

function PhotoImg({ src, alt, style }: { src: string; alt: string; style?: React.CSSProperties }) {
  const [err, setErr] = useState(false)
  if (err) return <div style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', color: '#94a3b8', fontSize: '.7rem' }}>🖼️</div>
  return <img src={src} alt={alt} style={style} onError={() => setErr(true)} />
}

export default function Photos() {
  const [photos, setPhotos] = useState<DailyPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [viewing, setViewing] = useState<DailyPhoto | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => {
    photoApi.list({ page_size: '100' })
      .then(r => setPhotos(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try { await photoApi.upload(file, todayStr()); load() }
    catch { alert('上传失败') }
    finally { setUploading(false) }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('删除这张照片？')) return
    try { await photoApi.delete(id); load(); setViewing(null) } catch { /* ignore */ }
  }

  const grouped: Record<string, DailyPhoto[]> = {}
  photos.forEach(p => { (grouped[p.date] ||= []).push(p) })

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: '.9rem', color: 'var(--text-secondary)' }}>全部照片 · {photos.length} 张</span>
        <button className="btn btn-primary btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? '上传中...' : '📷 拍照/相册'}
        </button>
      </div>
      <input ref={fileRef} type="file" accept="image/*"
        style={{ display: 'none' }} onChange={upload} />

      {loading ? (
        <div className="loading-spinner"><div className="spin" />加载中...</div>
      ) : photos.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: '2.5rem' }}>📸</div>
          <p style={{ color: 'var(--text-secondary)' }}>还没有照片</p>
        </div>
      ) : (
        Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0])).map(([date, items]) => (
          <div key={date} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>{date}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {items.map(p => (
                <div key={p.id} onClick={() => setViewing(p)} style={{
                  aspectRatio: '1', borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                }}>
                  <PhotoImg src={`/${p.file_path}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {viewing && (
        <div className="modal-overlay" onClick={() => setViewing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, padding: 16 }}>
            <PhotoImg src={`/${viewing.file_path}`} alt="" style={{ width: '100%', borderRadius: 8, maxHeight: '60vh', objectFit: 'contain' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: '.85rem', color: 'var(--text-secondary)' }}>
              <span>{viewing.date}</span>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(viewing.id)}>删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
