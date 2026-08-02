import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { dashboardApi, type DashboardSummary } from '../api'

export default function Dashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    dashboardApi.summary()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading-spinner"><div className="spin" />加载中...</div>
  if (error) return <div className="error-state">⚠ {error}</div>
  if (!data) return null

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">💪</div>
          <div><div className="stat-value">{data.today.sets}</div><div className="stat-label">今日组数</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow">🏃</div>
          <div><div className="stat-value">{data.today.exercises}</div><div className="stat-label">今日动作</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">🔥</div>
          <div><div className="stat-value">{data.streak} 天</div><div className="stat-label">连续打卡</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue">📅</div>
          <div><div className="stat-value">{data.week_days}</div><div className="stat-label">本周训练天数</div></div>
        </div>
      </div>

      <div className="card mb-4">
        <h2>⚡ 快捷操作</h2>
        <div className="quick-actions">
          <button className="btn btn-primary" onClick={() => navigate('/workouts')}>➕ 记录训练</button>
          <button className="btn btn-secondary" onClick={() => navigate('/photos')}>📸 上传照片</button>
          <button className="btn btn-secondary" onClick={() => navigate('/analysis')}>🤖 体态分析</button>
          <button className="btn btn-secondary" onClick={() => navigate('/goals')}>🎯 查看目标</button>
        </div>
      </div>

      <div className="card mb-4">
        <h2>🤖 最新体态评估</h2>
        {data.latest_analysis ? (
          <div>
            <p className="mb-2">{data.latest_analysis.posture_assessment || '暂无评估文字'}</p>
            {data.latest_analysis.shoulder_diff_cm != null && (
              <p className="mb-2">高低肩差值：<strong>{data.latest_analysis.shoulder_diff_cm} cm</strong></p>
            )}
            {data.latest_analysis.recommendations && (
              <div>
                <p className="text-secondary mb-1">改善建议：</p>
                <ul style={{ paddingLeft: 18, fontSize: '0.9rem', lineHeight: 1.8 }}>
                  {data.latest_analysis.recommendations.split(/[；;]/).filter(Boolean).map((r, i) => (
                    <li key={i}>{r.trim()}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="empty-state"><div className="icon">🤖</div><p>尚未进行 AI 分析，上传照片后点击分析即可</p></div>
        )}
      </div>

      <div className="card">
        <h2>📋 月度概览</h2>
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <div className="stat-card">
            <div className="stat-icon green">📊</div>
            <div><div className="stat-value">{data.month_sets}</div><div className="stat-label">本月累计组数</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon yellow">🎯</div>
            <div><div className="stat-value">{data.active_goals}</div><div className="stat-label">活跃目标</div></div>
          </div>
        </div>
      </div>
    </div>
  )
}
