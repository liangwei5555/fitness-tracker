import { workoutApi, type WorkoutRecord } from '../api'

interface Props {
  record: WorkoutRecord
  onUpdate: (r: WorkoutRecord) => void
  onDelete: (id: number) => void
}

export default function ExerciseCard({ record, onUpdate, onDelete }: Props) {
  const target = record.target_sets || record.sets || 0
  const completed = record.completed_sets || 0
  const isDone = target > 0 && completed >= target
  const pct = target > 0 ? Math.round((completed / target) * 100) : 0

  const tapSet = async (idx: number) => {
    // idx is 0-based; if clicking an already-completed set, undo; otherwise complete
    if (idx < completed) {
      // Undo this set and all after it
      try {
        // Undo one at a time from the end
        let r = record
        for (let i = completed; i > idx; i--) {
          r = await workoutApi.undoSet(r.id)
        }
        onUpdate(r)
      } catch { /* ignore */ }
    } else {
      try {
        const r = await workoutApi.completeSet(record.id)
        onUpdate(r)
      } catch { /* ignore */ }
    }
  }

  return (
    <div style={{
      background: isDone ? '#f0fdf4' : '#fff',
      border: `1px solid ${isDone ? '#bbf7d0' : 'var(--border)'}`,
      borderRadius: 12, padding: '14px 16px', marginBottom: 10,
      transition: 'all 0.2s',
      opacity: isDone ? 0.7 : 1,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: '1.1rem', fontWeight: 600,
            textDecoration: isDone ? 'line-through' : 'none',
            color: isDone ? '#16a34a' : 'var(--text)',
          }}>
            {record.exercise_name}
          </span>
          {isDone && <span style={{ fontSize: '1.1rem' }}>✅</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {(record.weight_kg ?? 0) > 0 && (
            <span style={{ fontSize: '.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              {record.weight_kg}kg
            </span>
          )}
          <span style={{ fontSize: '.85rem', color: 'var(--text-secondary)' }}>
            ×{target}组
          </span>
          {record.reps > 0 && (
            <span style={{ fontSize: '.85rem', color: 'var(--text-secondary)' }}>
              {record.reps}次/组
            </span>
          )}
          <button
            onClick={() => onDelete(record.id)}
            style={{
              background: 'none', border: 'none', color: '#94a3b8',
              fontSize: '1.2rem', cursor: 'pointer', padding: '2px 6px',
            }}
            title="删除"
          >×</button>
        </div>
      </div>

      {/* Set circles */}
      {target > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flex: 1 }}>
            {Array.from({ length: target }, (_, i) => (
              <button
                key={i}
                onClick={() => tapSet(i)}
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  border: `2px solid ${i < completed ? 'var(--green)' : '#d1d5db'}`,
                  background: i < completed ? 'var(--green)' : 'transparent',
                  color: i < completed ? '#fff' : 'transparent',
                  fontSize: '.85rem', fontWeight: 700,
                  cursor: 'pointer', transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {i < completed ? '✓' : i + 1}
              </button>
            ))}
          </div>
          <span style={{
            fontSize: '.82rem', fontWeight: 600, minWidth: 50, textAlign: 'right',
            color: isDone ? '#16a34a' : 'var(--text-secondary)',
          }}>
            {completed}/{target}
          </span>
        </div>
      )}

      {/* Progress bar */}
      {target > 0 && (
        <div style={{
          height: 4, borderRadius: 2, background: '#e5e7eb', marginTop: 10,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', width: `${pct}%`,
            background: isDone ? 'var(--green)' : 'var(--primary)',
            borderRadius: 2, transition: 'width 0.3s ease',
          }} />
        </div>
      )}

      {record.notes && (
        <div style={{ fontSize: '.78rem', color: '#94a3b8', marginTop: 8 }}>
          📝 {record.notes}
        </div>
      )}
    </div>
  )
}
