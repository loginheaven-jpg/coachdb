import { Slider, InputNumber, Space } from 'antd'

interface AutoScoreSliderProps {
  itemId: number
  itemName: string
  score: number
  onScoreChange: (score: number) => void
}

export default function AutoScoreSlider({
  itemId,
  itemName,
  score,
  onScoreChange
}: AutoScoreSliderProps) {
  return (
    <div className="auto-score-slider">
      <div style={{ marginBottom: 8 }}>
        <strong>{itemName}</strong>
      </div>
      <Space.Compact style={{ width: '100%' }}>
        <Slider
          min={0}
          max={100}
          value={score}
          onChange={onScoreChange}
          style={{ flex: 1, marginRight: 16 }}
          marks={{
            0: '0',
            25: '25',
            50: '50',
            75: '75',
            100: '100'
          }}
        />
        <InputNumber
          min={0}
          max={100}
          value={score}
          onChange={(value) => onScoreChange(value || 0)}
          addonAfter="점"
          style={{ width: 100 }}
        />
      </Space.Compact>
    </div>
  )
}
