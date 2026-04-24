type Direction = 'up' | 'down' | 'neutral'

interface MetricDeltaProps {
  value: number
  direction: Direction
  showPercent?: boolean
}

export default function MetricDelta({ value, direction, showPercent = true }: MetricDeltaProps) {
  if (direction === 'neutral') {
    return <span style={{ color: '#7EAFC4', fontSize: '11px' }}>— vs mês ant.</span>
  }
  const color = direction === 'up' ? '#10b981' : '#ef4444'
  const arrow = direction === 'up' ? '↑' : '↓'
  const label = showPercent ? `${Math.abs(value)}%` : String(Math.abs(value))
  return (
    <span className="text-xs font-semibold" style={{ color }}>
      {arrow}{label} vs mês ant.
    </span>
  )
}
