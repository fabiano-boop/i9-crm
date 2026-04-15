interface Props {
  score: number
  classification: 'HOT' | 'WARM' | 'COLD'
}

const classMap = {
  HOT: 'bg-red-100 text-red-700 border-red-200',
  WARM: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  COLD: 'bg-blue-100 text-blue-700 border-blue-200',
}

const labelMap = { HOT: '🔥 HOT', WARM: '🌤 WARM', COLD: '❄️ COLD' }

export default function ScoreBadge({ score, classification }: Props) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 bg-gray-200 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${
            classification === 'HOT' ? 'bg-red-500' : classification === 'WARM' ? 'bg-yellow-500' : 'bg-blue-400'
          }`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${classMap[classification]}`}>
        {labelMap[classification]}
      </span>
      <span className="text-xs text-gray-500">{score}</span>
    </div>
  )
}
