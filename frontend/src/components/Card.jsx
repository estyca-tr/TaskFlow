export default function Card({ children, className = '', hover = true, onClick }) {
  return (
    <div 
      className={`glass rounded-2xl p-6 ${hover ? 'card-hover cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

export function StatCard({ icon: Icon, label, value, trend, trendUp }) {
  return (
    <Card hover={false}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-muted text-sm mb-1">{label}</p>
          <p className="font-display font-bold text-3xl text-soft-white">{value}</p>
          {trend && (
            <p className={`text-sm mt-2 ${trendUp ? 'text-emerald-400' : 'text-rose-400'}`}>
              {trendUp ? '↑' : '↓'} {trend}
            </p>
          )}
        </div>
        <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
          <Icon className="w-6 h-6 text-accent" />
        </div>
      </div>
    </Card>
  )
}

