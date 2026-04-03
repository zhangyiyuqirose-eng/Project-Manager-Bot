import { Breadcrumb, Button, Space, Typography, theme } from 'antd'
import type { BreadcrumbItemType } from 'antd/es/breadcrumb/Breadcrumb'
import type { ReactNode } from 'react'

const { Title } = Typography

interface PageHeaderProps {
  /** 页面标题 */
  title: string
  /** 面包屑配置 */
  breadcrumb?: BreadcrumbItemType[]
  /** 操作按钮区域 */
  extra?: ReactNode
  /** 自定义样式 */
  style?: React.CSSProperties
}

function PageHeader({ title, breadcrumb, extra, style }: PageHeaderProps) {
  const { token } = theme.useToken()

  return (
    <div
      style={{
        padding: '16px 24px',
        background: '#fff',
        borderBottom: `1px solid ${token.colorBorder}`,
        marginBottom: 24,
        ...style,
      }}
    >
      {/* 面包屑 */}
      {breadcrumb && breadcrumb.length > 0 && (
        <Breadcrumb
          items={breadcrumb}
          style={{
            marginBottom: 8,
          }}
        />
      )}

      {/* 标题和操作区域 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Title
          level={4}
          style={{
            margin: 0,
            fontWeight: 600,
          }}
        >
          {title}
        </Title>

        {extra && (
          <Space size={8}>
            {extra}
          </Space>
        )}
      </div>
    </div>
  )
}

// 操作按钮组件
interface PageHeaderButtonProps {
  /** 按钮类型 */
  type?: 'primary' | 'default' | 'dashed' | 'text' | 'link'
  /** 按钮文字 */
  children: ReactNode
  /** 点击事件 */
  onClick?: () => void
  /** 是否禁用 */
  disabled?: boolean
  /** 是否加载状态 */
  loading?: boolean
  /** 图标 */
  icon?: ReactNode
}

export function PageHeaderButton({
  type = 'primary',
  children,
  onClick,
  disabled,
  loading,
  icon,
}: PageHeaderButtonProps) {
  return (
    <Button
      type={type}
      onClick={onClick}
      disabled={disabled}
      loading={loading}
      icon={icon}
      style={{
        borderRadius: 8,
      }}
    >
      {children}
    </Button>
  )
}

export default PageHeader