import { HomeOutlined } from '@ant-design/icons'
import './KCASubnav.css'

export interface SubnavItem {
  label: string
  active?: boolean
  onClick?: () => void
}

interface KCASubnavProps {
  items: SubnavItem[]
  onHomeClick?: () => void
}

export default function KCASubnav({ items, onHomeClick }: KCASubnavProps) {
  return (
    <div className="kca-subnav">
      <a className="kca-subnav-home" onClick={onHomeClick}>
        <HomeOutlined />
      </a>
      <div className="kca-subnav-items">
        {items.map((item, index) => (
          <div
            key={index}
            className={`kca-subnav-item ${item.active ? 'active' : ''}`}
            onClick={item.onClick}
          >
            {item.label} {index < items.length - 1 && <span className="arrow">▾</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
