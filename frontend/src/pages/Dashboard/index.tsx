import { useNavigate } from 'react-router-dom'
import { Card, Row, Col, Typography } from 'antd'
import {
  CalculatorOutlined,
  DollarOutlined,
  MonitorOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons'

const { Title, Text } = Typography

// 功能入口卡片组件 - 简约现代风格
interface FeatureCardProps {
  title: string
  description: string
  icon: React.ReactNode
  color: string
  gradient: string
  path: string
  features: string[]
  navigate: (path: string) => void
}

function FeatureCard({ title, description, icon, color, gradient, path, features, navigate }: FeatureCardProps) {
  return (
    <Card
      hoverable
      onClick={() => navigate(path)}
      style={{
        borderRadius: 20,
        border: '1px solid var(--color-border-light)',
        height: '100%',
        overflow: 'hidden',
        transition: 'all 0.25s ease',
        boxShadow: 'var(--shadow-sm)',
      }}
      styles={{
        body: { padding: 0 },
      }}
    >
      {/* 顶部渐变区域 - 更大留白 */}
      <div
        style={{
          background: gradient,
          padding: '48px 36px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: 'rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}
        >
          <span style={{ fontSize: 32, color: '#fff' }}>{icon}</span>
        </div>
        <Title level={3} style={{ color: '#fff', margin: 0, marginBottom: 12, fontWeight: 600 }}>
          {title}
        </Title>
        <Text style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: 15, lineHeight: 1.6 }}>
          {description}
        </Text>
      </div>

      {/* 功能列表 - 更大间距 */}
      <div style={{ padding: 32 }}>
        {features.map((feature, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '16px 0',
              borderBottom: index < features.length - 1 ? '1px solid var(--color-border-light)' : 'none',
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: color,
                opacity: 0.6,
              }}
            />
            <Text style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{feature}</Text>
          </div>
        ))}
      </div>

      {/* 底部操作区 - 更大间距 */}
      <div
        style={{
          padding: '24px 32px',
          borderTop: '1px solid var(--color-border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--color-bg-secondary)',
        }}
      >
        <Text style={{ fontSize: 15, color: color, fontWeight: 600 }}>立即使用</Text>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: `${color}12`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowRightOutlined style={{ color: color, fontSize: 14 }} />
        </div>
      </div>
    </Card>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()

  // 功能入口配置
  const featureCards = [
    {
      title: '实施成本预估',
      description: '基于AI智能分析的需求文档解析与工作量评估',
      icon: <CalculatorOutlined />,
      color: '#3B82F6',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      path: '/cost-estimate/upload',
      features: ['文档智能解析', '多维度参数配置', '工作量精准计算', 'Excel报告导出'],
    },
    {
      title: '成本消耗预估',
      description: '实时追踪项目成本消耗，预测燃尽时间',
      icon: <DollarOutlined />,
      color: '#10B981',
      gradient: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
      path: '/cost-consumption/input',
      features: ['OCR智能识别', '团队成本核算', '燃尽时间预测', '人员方案优化'],
    },
    {
      title: '成本偏差监控',
      description: 'AI驱动的成本偏差分析与智能调整建议',
      icon: <MonitorOutlined />,
      color: '#8B5CF6',
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      path: '/cost-deviation/input',
      features: ['大模型智能识别', '偏差可视化分析', 'AI调整建议', '风险预警提醒'],
    },
  ]

  return (
    <div className="page-container" style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* 欢迎区域 - 简约风格，更大留白 */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          borderRadius: 24,
          padding: '64px 56px',
          marginBottom: 48,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Title level={1} style={{ color: '#fff', margin: 0, marginBottom: 16, fontWeight: 700, fontSize: 36 }}>
            IT项目智能成本管控平台
          </Title>
          <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 18, display: 'block', marginBottom: 32, lineHeight: 1.6 }}>
            智能估算 · 精准管控 · 让每一分项目成本清晰可见
          </Text>
          <div style={{ display: 'flex', gap: 32, marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981' }} />
              <Text style={{ color: 'rgba(255, 255, 255, 0.55)', fontSize: 14 }}>AI 智能分析</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3B82F6' }} />
              <Text style={{ color: 'rgba(255, 255, 255, 0.55)', fontSize: 14 }}>OCR 文档识别</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#8B5CF6' }} />
              <Text style={{ color: 'rgba(255, 255, 255, 0.55)', fontSize: 14 }}>实时成本监控</Text>
            </div>
          </div>
        </div>
      </div>

      {/* 功能入口卡片 - 更大间距 */}
      <Row gutter={[32, 32]}>
        {featureCards.map((card) => (
          <Col xs={24} lg={8} key={card.path}>
            <FeatureCard {...card} navigate={navigate} />
          </Col>
        ))}
      </Row>
    </div>
  )
}