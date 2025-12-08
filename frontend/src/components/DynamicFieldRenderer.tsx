/**
 * 동적 필드 렌더링 컴포넌트
 *
 * CompetencyItemField 기반으로 템플릿별 입력 필드를 동적으로 렌더링
 */
import { useState } from 'react'
import { Input, InputNumber, Select, Upload, Button, Space, Card, Typography } from 'antd'
import { PlusOutlined, MinusCircleOutlined, UploadOutlined } from '@ant-design/icons'
import { CompetencyItem, CompetencyItemField } from '../services/projectService'

const { Text } = Typography

interface DynamicFieldRendererProps {
  item: CompetencyItem
  value: any
  onChange: (value: any) => void
  disabled?: boolean
}

interface FieldEntry {
  [fieldName: string]: any
}

export default function DynamicFieldRenderer({ item, value, onChange, disabled }: DynamicFieldRendererProps) {
  // For repeatable items, value is array of entries
  // For single items, value is a single entry object
  const isRepeatable = item.is_repeatable
  const entries: FieldEntry[] = isRepeatable
    ? (Array.isArray(value) ? value : [{}])
    : [value || {}]

  const updateEntry = (index: number, fieldName: string, fieldValue: any) => {
    const newEntries = [...entries]
    newEntries[index] = {
      ...newEntries[index],
      [fieldName]: fieldValue
    }

    if (isRepeatable) {
      onChange(newEntries)
    } else {
      onChange(newEntries[0])
    }
  }

  const addEntry = () => {
    if (!isRepeatable) return
    onChange([...entries, {}])
  }

  const removeEntry = (index: number) => {
    if (!isRepeatable || entries.length <= 1) return
    const newEntries = entries.filter((_, i) => i !== index)
    onChange(newEntries)
  }

  const renderField = (field: CompetencyItemField, entryValue: any, onFieldChange: (val: any) => void) => {
    const commonProps = {
      disabled,
      placeholder: field.placeholder || undefined,
      style: { width: '100%' }
    }

    switch (field.field_type) {
      case 'text':
        return (
          <Input
            {...commonProps}
            value={entryValue}
            onChange={(e) => onFieldChange(e.target.value)}
          />
        )

      case 'number':
        return (
          <InputNumber
            {...commonProps}
            value={entryValue}
            onChange={onFieldChange}
          />
        )

      case 'select':
        const options = field.field_options ? JSON.parse(field.field_options) : []
        return (
          <Select
            {...commonProps}
            value={entryValue}
            onChange={onFieldChange}
          >
            {options.map((opt: string) => (
              <Select.Option key={opt} value={opt}>
                {opt}
              </Select.Option>
            ))}
          </Select>
        )

      case 'multiselect':
        const multiOptions = field.field_options ? JSON.parse(field.field_options) : []
        return (
          <Select
            {...commonProps}
            mode="multiple"
            value={entryValue}
            onChange={onFieldChange}
          >
            {multiOptions.map((opt: string) => (
              <Select.Option key={opt} value={opt}>
                {opt}
              </Select.Option>
            ))}
          </Select>
        )

      case 'file':
        return (
          <Upload
            disabled={disabled}
            maxCount={1}
            fileList={entryValue ? [entryValue] : []}
            onChange={(info) => onFieldChange(info.fileList[0])}
          >
            <Button icon={<UploadOutlined />} disabled={disabled}>
              {field.field_label}
            </Button>
          </Upload>
        )

      default:
        return <Input {...commonProps} value={entryValue} onChange={(e) => onFieldChange(e.target.value)} />
    }
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      {entries.map((entry, entryIndex) => (
        <Card
          key={entryIndex}
          size="small"
          title={isRepeatable ? `${item.item_name} #${entryIndex + 1}` : item.item_name}
          extra={
            isRepeatable && entries.length > 1 && !disabled && (
              <Button
                type="text"
                danger
                size="small"
                icon={<MinusCircleOutlined />}
                onClick={() => removeEntry(entryIndex)}
              >
                삭제
              </Button>
            )
          }
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            {item.fields
              .sort((a, b) => a.display_order - b.display_order)
              .map((field) => (
                <div key={field.field_id}>
                  <div style={{ marginBottom: 4 }}>
                    <Text strong>{field.field_label}</Text>
                    {field.is_required && <Text type="danger"> *</Text>}
                  </div>
                  {renderField(
                    field,
                    entry[field.field_name],
                    (val) => updateEntry(entryIndex, field.field_name, val)
                  )}
                </div>
              ))}
          </Space>
        </Card>
      ))}

      {isRepeatable && !disabled && (
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={addEntry}
          block
          disabled={item.max_entries ? entries.length >= item.max_entries : false}
        >
          {item.item_name} 추가
          {item.max_entries && ` (${entries.length}/${item.max_entries})`}
        </Button>
      )}
    </Space>
  )
}
