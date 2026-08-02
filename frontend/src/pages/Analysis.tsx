import { useEffect, useState } from 'react'
import { analysisApi, photoApi, type DailyPhoto } from '../api'

interface TrendItem {
  date: string; shoulder_diff_cm: number | null; posture_assessment: string | null
  spine_alignment: string | null; pelvis_tilt: string | null; photo_id: number
}

export default function Analysis() {
  const [trend, setTrend] = useState<TrendItem[]>([])
  const [photos, setPhotos] = useState<DailyPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [analyzingId, setAnalyzingId] = useState<number | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([analysisApi.trend(), photoApi.list({ page_size: '100' })])
      .then(([t, p]) => { setTrend(t); setPhotos(p.data) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const trigger = async (photoId: number) => {
    setAnalyzingId(photoId)
    try { await analysisApi.trigger(photoId); load() }
    catch (e: any) { alert(e.message) }
    finally { setAnalyzingId(null) }
  }

  if (loading) return <div className="loading-spinner"><div className="spin" />加载中...</div>
  if (error) return <div className="error-state">⚠ {error}</div>

  return (
    <div>
      {/* 趋势概览 */}
      <div className="card mb-4">
        <h2>📈 高低肩差值变化趋势</h2>
        {trend.filter(t => t.shoulder_diff_cm != null).length > 0 ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 160, padding: '10px 0', overflowX: 'auto' }}>
              {trend.filter(t => t.shoulder_diff_cm != null).map(t => {
                const val = t.shoulder_diff_cm!
                const maxVal = Math.max(...trend.map(x => x.shoulder_diff_cm || 0), 3)
                const h = (val / maxVal) * 130
                return (
                  <div key={t.photo_id} style={{ textAlign: 'center', minWidth: 50 }}>
                    <div style={{ height: 130, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                      <div style={{ width: 32, height: h, background: val > 1.5 ? 'var(--red)' : 'var(--green)', borderRadius: '6px 6px 0 0', minHeight: 8 }} />
                    </div>
                    <div style={{ fontSize: '0.7rem', marginTop: 4 }}>{val}cm</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{t.date}</div>
                  </div>
                )
              })}
            </div>
            <p className="text-secondary mt-2">
              目标：<strong>≤ 0.5 cm</strong>（理想对称）| 当前最低：{Math.min(...trend.filter(t => t.shoulder_diff_cm != null).map(t => t.shoulder_diff_cm!)).toFixed(1)} cm
            </p>
          </div>
        ) : (
          <div className="empty-state"><p>暂无分析数据</p></div>
        )}
      </div>

      {/* 历史分析记录 */}
      <div className="card">
        <h2>📋 历史分析记录</h2>
        {trend.length === 0 ? (
          <div className="empty-state"><div className="icon">🤖</div><p>还没有分析记录，去照片墙对照片进行分析</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>日期</th><th>高低肩差</th><th>脊柱评估</th><th>骨盆评估</th><th>体态评估</th></tr></thead>
              <tbody>
                {trend.map(t => (
                  <tr key={t.photo_id}>
                    <td>{t.date}</td>
                    <td>{t.shoulder_diff_cm != null ? `${t.shoulder_diff_cm} cm` : '-'}</td>
                    <td>{t.spine_alignment || '-'}</td>
                    <td>{t.pelvis_tilt || '-'}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.posture_assessment || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 未分析的照片 */}
      {photos.filter(p => !trend.some(t => t.photo_id === p.id)).length > 0 && (
        <div className="card mt-4">
          <h2>📸 待分析照片</h2>
          <div className="photo-grid">
            {photos.filter(p => !trend.some(t => t.photo_id === p.id)).slice(0, 6).map(p => (
              <div key={p.id} className="photo-card">
                <img src={`/${p.file_path}`} alt="" />
                <div className="photo-info">
                  <div>{p.date}</div>
                  <button className="btn btn-sm btn-primary mt-1"
                    onClick={() => trigger(p.id)} disabled={analyzingId === p.id}>
                    🤖 {analyzingId === p.id ? '分析中...' : '分析'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
