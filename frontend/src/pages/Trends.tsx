import { useEffect, useState } from 'react'
import { workoutApi, analysisApi } from '../api'

interface WorkoutTrend { week: string; sets: number; exercises: number }

export default function Trends() {
  const [workoutTrend, setWorkoutTrend] = useState<WorkoutTrend[]>([])
  const [shoulderTrend, setShoulderTrend] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      workoutApi.list({ page_size: '200' }),
      analysisApi.trend(),
    ]).then(([wData, aData]) => {
      // 按周聚合训练数据
      const weekMap: Record<string, { sets: number; exercises: Set<string> }> = {}
      wData.data.forEach((r: any) => {
        const d = new Date(r.date)
        const weekStart = new Date(d.getTime() - d.getDay() * 86400000).toISOString().slice(0, 10)
        if (!weekMap[weekStart]) weekMap[weekStart] = { sets: 0, exercises: new Set() }
        weekMap[weekStart].sets += r.sets
        weekMap[weekStart].exercises.add(r.exercise_name)
      })
      const trend = Object.entries(weekMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([week, data]) => ({ week, sets: data.sets, exercises: data.exercises.size }))
      setWorkoutTrend(trend)
      setShoulderTrend(aData.filter((d: any) => d.shoulder_diff_cm != null))
    }).catch(e => setError(e.message))
    .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading-spinner"><div className="spin" />加载中...</div>
  if (error) return <div className="error-state">⚠ {error}</div>

  const maxSets = Math.max(...workoutTrend.map(w => w.sets), 1)

  return (
    <div>
      {/* 训练趋势 */}
      <div className="card mb-4">
        <h2>💪 每周训练量趋势</h2>
        {workoutTrend.length === 0 ? (
          <div className="empty-state"><p>还没有训练记录</p></div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160, padding: '10px 0' }}>
              {workoutTrend.map(w => {
                const h = (w.sets / maxSets) * 140
                return (
                  <div key={w.week} style={{ textAlign: 'center', flex: 1, minWidth: 0 }} title={`${w.week}: ${w.sets}组, ${w.exercises}个动作`}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: 2 }}>{w.sets}</div>
                    <div style={{ height: 140, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                      <div style={{ width: '70%', maxWidth: 40, height: Math.max(h, 4), background: 'var(--primary)', borderRadius: '6px 6px 0 0', opacity: 0.8 }} />
                    </div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', marginTop: 4, transform: 'rotate(-45deg)', transformOrigin: 'top left', whiteSpace: 'nowrap' }}>
                      {w.week.slice(5)}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-2 mt-3 text-secondary" style={{ fontSize: '0.8rem' }}>
              <span>📊 总计：{workoutTrend.reduce((s, w) => s + w.sets, 0)} 组</span>
              <span>📅 平均：{Math.round(workoutTrend.reduce((s, w) => s + w.sets, 0) / workoutTrend.length)} 组/周</span>
            </div>
          </div>
        )}
      </div>

      {/* 体态变化 */}
      <div className="card mb-4">
        <h2>📈 高低肩差值变化</h2>
        {shoulderTrend.length === 0 ? (
          <div className="empty-state"><p>还没有体态分析数据</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>日期</th><th>高低肩差值</th><th>变化</th></tr></thead>
              <tbody>
                {shoulderTrend.map((t, i) => {
                  const prev = i > 0 ? shoulderTrend[i - 1].shoulder_diff_cm : null
                  const diff = prev != null && t.shoulder_diff_cm != null ? t.shoulder_diff_cm - prev : null
                  return (
                    <tr key={t.photo_id}>
                      <td>{t.date}</td>
                      <td style={{ fontWeight: 600 }}>{t.shoulder_diff_cm} cm</td>
                      <td>
                        {diff == null ? '-' : diff < 0
                          ? <span style={{ color: 'var(--green)' }}>↓ {Math.abs(diff).toFixed(1)} 改善</span>
                          : diff > 0
                            ? <span style={{ color: 'var(--red)' }}>↑ {diff.toFixed(1)}</span>
                            : <span>→ 0</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 训练分布 */}
      <div className="card">
        <h2>🎯 关键建议</h2>
        <ul style={{ paddingLeft: 18, lineHeight: 2 }}>
          <li>保持每周至少 <strong>3-4 天</strong> 训练频率</li>
          <li>针对高低肩问题，注意 <strong>双侧均衡训练</strong>（单臂动作交替进行）</li>
          <li>每次训练后上传照片，持续追踪体态变化</li>
          <li>结合 AI 分析建议，动态调整训练计划</li>
          <li>定期（每2周）手动测量高低肩差值，校准 AI 分析结果</li>
        </ul>
      </div>
    </div>
  )
}
