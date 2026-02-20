const moods = [
  { value: 1, emoji: '😞', label: 'קשה' },
  { value: 2, emoji: '😕', label: 'לא טוב' },
  { value: 3, emoji: '😐', label: 'בסדר' },
  { value: 4, emoji: '🙂', label: 'טוב' },
  { value: 5, emoji: '😄', label: 'מעולה' },
]

export default function MoodSelector({ label, value, onChange }) {
  return (
    <div className="space-y-3">
      {label && (
        <label className="block text-sm font-medium text-muted">{label}</label>
      )}
      <div className="flex gap-2">
        {moods.map((mood) => (
          <button
            key={mood.value}
            type="button"
            onClick={() => onChange(mood.value)}
            className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all duration-200 ${
              value === mood.value
                ? 'bg-accent/20 ring-2 ring-accent scale-110'
                : 'bg-slate-800/50 hover:bg-slate-700/50'
            }`}
          >
            <span className="text-2xl">{mood.emoji}</span>
            <span className="text-xs text-muted">{mood.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function MoodDisplay({ value, size = 'md' }) {
  const mood = moods.find(m => m.value === value)
  if (!mood) return null
  
  const sizes = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-4xl'
  }
  
  return (
    <span className={sizes[size]} title={mood.label}>
      {mood.emoji}
    </span>
  )
}

