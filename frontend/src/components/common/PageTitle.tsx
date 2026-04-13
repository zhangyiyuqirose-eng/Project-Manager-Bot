import { Typography } from 'antd'
import type { ReactNode } from 'react'

const { Title, Text } = Typography

interface PageTitleProps {
  title: string
  description?: string
  icon?: ReactNode
}

/**
 * 简约页面标题组件 - 替代臃肿的Hero区域
 * 使用方式: <PageTitle title="页面标题" description="描述文字" icon={<Icon />} />
 */
export default function PageTitle({ title, description, icon }: PageTitleProps) {
  return (
    <div className="page-title-section">
      <div className="page-title-content">
        {icon && (
          <div className="page-title-icon">
            {icon}
          </div>
        )}
        <div>
          <Title level={4} className="page-title-text">{title}</Title>
          {description && (
            <Text className="page-title-desc">{description}</Text>
          )}
        </div>
      </div>
    </div>
  )
}