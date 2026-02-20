export function Input({ 
  label, 
  type = 'text', 
  placeholder, 
  value, 
  onChange, 
  error,
  className = '',
  ...props 
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-muted">{label}</label>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`w-full px-4 py-3 rounded-xl ${error ? 'border-rose-500' : ''}`}
        {...props}
      />
      {error && (
        <p className="text-sm text-rose-400">{error}</p>
      )}
    </div>
  )
}

export function TextArea({ 
  label, 
  placeholder, 
  value, 
  onChange, 
  rows = 4,
  error,
  className = '',
  ...props 
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-muted">{label}</label>
      )}
      <textarea
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        rows={rows}
        className={`w-full px-4 py-3 rounded-xl resize-none ${error ? 'border-rose-500' : ''}`}
        {...props}
      />
      {error && (
        <p className="text-sm text-rose-400">{error}</p>
      )}
    </div>
  )
}

export function Select({ 
  label, 
  value, 
  onChange, 
  options, 
  placeholder,
  error,
  className = '',
  ...props 
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-muted">{label}</label>
      )}
      <select
        value={value}
        onChange={onChange}
        className={`w-full px-4 py-3 rounded-xl ${error ? 'border-rose-500' : ''}`}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>{placeholder}</option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="text-sm text-rose-400">{error}</p>
      )}
    </div>
  )
}

