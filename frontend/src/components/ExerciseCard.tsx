import { useRef, useCallback } from 'react'
import { workoutApi, type WorkoutRecord } from '../api'

interface Props { record: WorkoutRecord; onUpdate: (r: WorkoutRecord) => void; onDelete: (id: number) => void }

export default function ExerciseCard({ record, onUpdate, onDelete }: Props) {
  const target = record.target_sets || record.sets || 0
  const completed = record.completed_sets || 0
  const isDone = target > 0 && completed >= target
  const pct = target > 0 ? Math.round((completed / target) * 100) : 0
  const recordRef = useRef(record); recordRef.current = record
  // 序列号：只应用最新一次 API 调用的结果，防止快速连点时 UI 闪烁
  const seqRef = useRef(0)

  const plus = useCallback(() => {
    if (completed >= target) return
    const next = completed + 1
    onUpdate({ ...recordRef.current, completed_sets: next })
    const seq = ++seqRef.current
    workoutApi.completeSet(recordRef.current.id)
      .then(r => { if (seq === seqRef.current) onUpdate(r) })
      .catch(() => { if (seq === seqRef.current) onUpdate(recordRef.current) })
  }, [completed, target, onUpdate])

  const minus = useCallback(() => {
    if (completed <= 0) return
    const next = completed - 1
    onUpdate({ ...recordRef.current, completed_sets: next })
    const seq = ++seqRef.current
    workoutApi.undoSet(recordRef.current.id)
      .then(r => { if (seq === seqRef.current) onUpdate(r) })
      .catch(() => { if (seq === seqRef.current) onUpdate(recordRef.current) })
  }, [completed, onUpdate])

  // 一键完成：直接设为目标组数
  const completeAll = useCallback(() => {
    if (isDone) return
    onUpdate({ ...recordRef.current, completed_sets: target })
    const seq = ++seqRef.current
    workoutApi.update(recordRef.current.id, { completed_sets: target })
      .then(r => { if (seq === seqRef.current) onUpdate(r) })
      .catch(() => { if (seq === seqRef.current) onUpdate(recordRef.current) })
  }, [target, isDone, onUpdate])

  return (
    <div style={{ background: isDone ? '#f0fdf4' : '#fff', border: `1px solid ${isDone ? '#bbf7d0' : 'var(--border)'}`, borderRadius: 12, padding: '12px 14px', marginBottom: 8, opacity: isDone ? 0.75 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: '1rem', fontWeight: 600, textDecoration: isDone ? 'line-through' : 'none', color: isDone ? '#16a34a' : 'var(--text)' }}>
          {isDone && '✅ '}{record.exercise_name}
        </span>
        <button onClick={() => onDelete(record.id)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer', padding: '2px 6px' }}>×</button>
      </div>
      <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
        {target > 0 && <span>目标 {target} 组</span>}
        {record.reps > 0 && <span> · 每组 {record.reps} 次</span>}
        {(record.weight_kg ?? 0) > 0 && <span> · {record.weight_kg}kg</span>}
      </div>
      {target > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onTouchStart={e => { e.preventDefault(); minus() }}
              onMouseDown={e => { e.preventDefault(); minus() }}
              disabled={completed <= 0}
              style={btnStyle(completed <= 0)}>−</button>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <span style={{ fontSize: '1.3rem', fontWeight: 700, color: isDone ? '#16a34a' : 'var(--text)' }}>{completed}</span>
              <span style={{ fontSize: '.85rem', color: 'var(--text-secondary)' }}> / {target} 组</span>
            </div>
            <button
              onTouchStart={e => { e.preventDefault(); plus() }}
              onMouseDown={e => { e.preventDefault(); plus() }}
              disabled={completed >= target}
              style={btnStyle(completed >= target)}>＋</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <div style={{ flex: 1, height: 5, borderRadius: 3, background: '#e5e7eb', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: isDone ? 'var(--green)' : 'var(--primary)', borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
            {!isDone && (
              <button
                onTouchStart={e => { e.preventDefault(); completeAll() }}
                onMouseDown={e => { e.preventDefault(); completeAll() }}
                style={{ ...btnCompleteStyle, touchAction: 'manipulation', userSelect: 'none' }}>
                ✓完成
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const btnCompleteStyle: React.CSSProperties = {
  padding: '3px 10px', borderRadius: 12, border: '1px solid var(--green)',
  background: '#fff', color: 'var(--green)', fontSize: '.72rem', fontWeight: 600,
  cursor: 'pointer', whiteSpace: 'nowrap',
}

function btnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 36, height: 36, borderRadius: '50%',
    border: `2px solid ${disabled ? '#e5e7eb' : 'var(--primary)'}`,
    background: disabled ? '#f9fafb' : '#fff',
    color: disabled ? '#d1d5db' : 'var(--primary)',
    fontSize: '1.2rem', fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    touchAction: 'manipulation', userSelect: 'none',
  }
}
