import { Button, Typography, theme } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import type { ReactNode } from 'react'

const { Text } = Typography

interface EmptyStateProps {
  /** 提示文字 */
  description: string
  /** 自定义图标 */
  icon?: ReactNode
  /** 操作按钮文字 */
  buttonText?: string
  /** 操作按钮点击事件 */
  onButtonClick?: () => void
  /** 自定义样式 */
  style?: React.CSSProperties
}

function EmptyState({
  description,
  icon,
  buttonText,
  onButtonClick,
  style,
}: EmptyStateProps) {
  const { token } = theme.useToken()

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
        color: '#86909C',
        ...style,
      }}
    >
      {/* 图标 */}
      <div
        style={{
          fontSize: 64,
          marginBottom: 16,
          color: token.colorTextDisabled,
        }}
      >
        {icon || <InboxOutlined />}
      </div>

      {/* 提示文字 */}
      <Text
        style={{
          color: token.colorTextSecondary,
          fontSize: 14,
          marginBottom: buttonText ? 24 : 0,
          textAlign: 'center',
        }}
      >
        {description}
      </Text>

      {/* 操作按钮 */}
      {buttonText && onButtonClick && (
        <Button
          type="primary"
          onClick={onButtonClick}
          style={{
            borderRadius: 8,
          }}
        >
          {buttonText}
        </Button>
      )}
    </div>
  )
}

export default EmptyState