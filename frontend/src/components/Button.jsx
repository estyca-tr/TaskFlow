export default function Button({ 
  children, 
  variant = 'primary', 
  size = 'md',
  className = '',
  disabled = false,
  onClick,
  type = 'button'
}) {
  const baseStyles = 'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed'
  
  const variants = {
    primary: 'bg-gradient-to-r from-accent to-amber-600 text-midnight hover:shadow-lg hover:shadow-accent/25 hover:scale-[1.02]',
    secondary: 'bg-slate-700/50 text-soft-white hover:bg-slate-600/50 border border-slate-600',
    ghost: 'text-muted hover:text-soft-white hover:bg-slate-800/50',
    danger: 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30',
  }
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5',
    lg: 'px-8 py-3 text-lg',
  }

  return (
    <button
      type={type}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

