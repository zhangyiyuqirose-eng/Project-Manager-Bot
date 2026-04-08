import { Card, Typography, theme } from 'antd'
import type { ReactNode } from 'react'

const { Text, Title } = Typography

interface StatisticCardProps {
  /** 标题 */
  title: string
  /** 数值 */
  value: number | string
  /** 单位 */
  unit?: string
  /** 图标 */
  icon?: ReactNode
  /** 是否为危险状态（红色显示） */
  danger?: boolean
  /** 点击跳转路径 */
  onClick?: () => void
  /** 数值格式化函数 */
  formatter?: (value: number | string) => string
  /** 自定义样式 */
  style?: React.CSSProperties
}

function StatisticCard({
  title,
  value,
  unit,
  icon,
  danger = false,
  onClick,
  formatter,
  style,
}: StatisticCardProps) {
  const { token } = theme.useToken()

  // 格式化显示值
  const displayValue = formatter ? formatter(value) : value

  // 处理点击事件
  const handleClick = () => {
    if (onClick) {
      onClick()
    }
  }

  return (
    <Card
      style={{
        borderRadius: 8,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.3s',
        ...style,
      }}
      styles={{
        body: {
          padding: 24,
        },
      }}
      hoverable={!!onClick}
      onClick={handleClick}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        {/* 左侧：标题和数值 */}
        <div style={{ flex: 1 }}>
          <Text
            style={{
              color: token.colorTextSecondary,
              fontSize: 14,
              marginBottom: 8,
              display: 'block',
            }}
          >
            {title}
          </Text>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <Title
              level={4}
              style={{
                margin: 0,
                color: danger ? token.colorError : token.colorPrimary,
                fontWeight: 600,
              }}
            >
              {displayValue}
            </Title>
            {unit && (
              <Text
                style={{
                  color: danger ? token.colorError : token.colorTextSecondary,
                  fontSize: 14,
                }}
              >
                {unit}
              </Text>
            )}
          </div>
        </div>

        {/* 右侧：图标 */}
        {icon && (
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: danger
                ? `rgba(${token.colorError}, 0.1)`
                : `rgba(${token.colorPrimary}, 0.1)`,
              color: danger ? token.colorError : token.colorPrimary,
              fontSize: 24,
            }}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  )
}

export default StatisticCard