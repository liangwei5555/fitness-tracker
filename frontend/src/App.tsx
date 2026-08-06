import { Routes, Route, NavLink } from 'react-router-dom'
import TodayWorkout from './pages/TodayWorkout'
import Photos from './pages/Photos'
import Stats from './pages/Stats'
import Goals from './pages/Goals'
import LoginGate from './components/LoginGate'
import './App.css'

const TABS = [
  { to: '/', label: '训练', icon: '📅', exact: true },
  { to: '/photos', label: '相册', icon: '🖼️' },
  { to: '/stats', label: '统计', icon: '📊' },
  { to: '/goals', label: '目标', icon: '🎯' },
]

export default function App() {
  return (
    <LoginGate>
      <div className="app-layout">
        {/* Top bar */}
        <header className="topbar">
          <span className="brand-icon" style={{ fontSize: '1.3rem' }}>💪</span>
          <h1 className="page-title" style={{ fontSize: '1rem', margin: 0 }}>小梁健身</h1>
        </header>

        {/* Content */}
        <main className="content">
          <Routes>
            <Route path="/" element={<TodayWorkout />} />
            <Route path="/photos" element={<Photos />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/goals" element={<Goals />} />
          </Routes>
        </main>

        {/* Bottom nav */}
        <nav className="bottom-nav">
          {TABS.map(t => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.exact}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{t.icon}</span>
              <span className="nav-label">{t.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </LoginGate>
  )
}
