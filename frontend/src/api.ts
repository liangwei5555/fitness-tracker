const BASE = '/api'

function getToken(): string | null {
  return localStorage.getItem('fitness_token')
}

function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T=unknown>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...options?.headers },
    ...options,
  })
  if (res.status === 401) {
    localStorage.removeItem('fitness_token')
    window.location.reload()
    throw new Error('登录已过期')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

// ─── 训练记录 ───
export const workoutApi = {
  list: (params?: Record<string, string>) =>
    request<{ data: WorkoutRecord[]; total: number }>(`/workouts/?${new URLSearchParams(params || {})}`),
  create: (data: Partial<WorkoutRecord>) =>
    request<WorkoutRecord>('/workouts/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<WorkoutRecord>) =>
    request<WorkoutRecord>(`/workouts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<{ ok: boolean }>(`/workouts/${id}`, { method: 'DELETE' }),
  completeSet: (id: number) =>
    request<WorkoutRecord>(`/workouts/${id}/complete-set`, { method: 'POST' }),
  undoSet: (id: number) =>
    request<WorkoutRecord>(`/workouts/${id}/undo-set`, { method: 'POST' }),
}

// ─── 照片 ───
export const photoApi = {
  list: (params?: Record<string, string>) =>
    request<{ data: DailyPhoto[] }>(`/photos/?${new URLSearchParams(params || {})}`),
  upload: async (file: File, date: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('date_str', date)
    form.append('view_type', '正面')
    const res = await fetch(BASE + '/photos/upload', {
      method: 'POST', body: form, headers: { ...authHeaders() },
    })
    if (res.status === 401) {
      localStorage.removeItem('fitness_token')
      window.location.reload()
      throw new Error('登录已过期')
    }
    if (!res.ok) throw new Error('上传失败')
    return res.json()
  },
  delete: (id: number) => request<{ ok: boolean }>(`/photos/${id}`, { method: 'DELETE' }),
}

// ─── 目标 ───
export const goalApi = {
  list: (activeOnly = false) => request<ImprovementGoal[]>(`/goals/?active_only=${activeOnly}`),
  create: (data: Partial<ImprovementGoal>) =>
    request<ImprovementGoal>('/goals/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<ImprovementGoal>) =>
    request<ImprovementGoal>(`/goals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
}

// ─── 仪表盘 ───
export const dashboardApi = {
  summary: () => request<DashboardSummary>('/dashboard/summary'),
}

// ─── 类型 ───
export interface WorkoutRecord {
  id: number; date: string; exercise_name: string
  sets: number; target_sets: number; completed_sets: number
  reps: number; weight_kg: number | null; notes: string | null
}
export interface DailyPhoto {
  id: number; date: string; file_path: string; view_type: string; notes: string | null
}
export interface ImprovementGoal {
  id: number; goal_name: string; target_metric: string
  initial_value: number | null; current_value: number | null
  target_value: number | null; unit: string | null
  description: string | null; is_active: boolean
  started_at: string; target_date: string | null
}
export interface DashboardSummary {
  today: { sets: number; exercises: number; records: number }
  week_days: number; month_sets: number; streak: number
  active_goals: number
}
