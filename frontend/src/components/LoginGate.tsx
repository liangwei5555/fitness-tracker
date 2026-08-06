import { useState } from 'react'

interface Props {
  children: React.ReactNode
}

export default function LoginGate({ children }: Props) {
  const [token, setToken] = useState(() => localStorage.getItem('fitness_token'))
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!password.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ detail: '登录失败' }))
        throw new Error(data.detail || '密码错误')
      }
      const data = await res.json()
      localStorage.setItem('fitness_token', data.token)
      setToken(data.token)
    } catch (e: any) {
      setError(e.message || '登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('fitness_token')
    setToken(null)
    setPassword('')
    setError('')
  }

  if (token) {
    // 把 logout 方法挂到 window 上供调试用
    ;(window as any).__logout = handleLogout
    return <>{children}</>
  }

  return (
    <div className="login-gate">
      <div className="login-card">
        <div className="login-icon">💪</div>
        <h1 className="login-title">小梁健身</h1>
        <p className="login-desc">输入密码查看训练数据</p>

        <input
          className="login-input"
          type="password"
          placeholder="请输入密码"
          value={password}
          onChange={e => { setPassword(e.target.value); setError('') }}
          onKeyDown={e => { if (e.key === 'Enter') handleLogin() }}
          autoFocus
          disabled={loading}
        />

        {error && <p className="login-error">{error}</p>}

        <button className="login-btn" onClick={handleLogin} disabled={loading}>
          {loading ? '验证中...' : '进入'}
        </button>
      </div>
    </div>
  )
}
