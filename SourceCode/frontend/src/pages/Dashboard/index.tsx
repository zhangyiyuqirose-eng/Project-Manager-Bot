import { useNavigate } from 'react-router-dom'
import { Card, Row, Col, Typography } from 'antd'
import {
  CalculatorOutlined,
  DollarOutlined,
  MonitorOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons'

const { Title, Text } = Typography

// 功能入口卡片组件
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
        borderRadius: 24,
        border: 'none',
        height: '100%',
        overflow: 'hidden',
        transition: 'all 0.3s ease',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
      }}
      styles={{
        body: { padding: 0 },
      }}
    >
      {/* 顶部渐变区域 */}
      <div
        style={{
          background: gradient,
          padding: '40px 32px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -30,
            right: -30,
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.15)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -20,
            left: -20,
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)',
          }}
        />
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            background: 'rgba(255, 255, 255, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
            backdropFilter: 'blur(10px)',
          }}
        >
          <span style={{ fontSize: 36, color: '#fff' }}>{icon}</span>
        </div>
        <Title level={3} style={{ color: '#fff', margin: 0, marginBottom: 8, fontWeight: 600 }}>
          {title}
        </Title>
        <Text style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: 15 }}>
          {description}
        </Text>
      </div>

      {/* 功能列表 */}
      <div style={{ padding: 24 }}>
        {features.map((feature, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 0',
              borderBottom: index < features.length - 1 ? '1px solid #f1f5f9' : 'none',
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: gradient,
              }}
            />
            <Text style={{ fontSize: 14, color: '#475569' }}>{feature}</Text>
          </div>
        ))}
      </div>

      {/* 底部操作区 */}
      <div
        style={{
          padding: '20px 24px',
          borderTop: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#fafafa',
        }}
      >
        <Text style={{ fontSize: 15, color: color, fontWeight: 600 }}>立即使用</Text>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: `${color}15`,
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
      {/* 欢迎区域 */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          borderRadius: 24,
          padding: '48px 56px',
          marginBottom: 40,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 装饰元素 */}
        <div style={{ position: 'absolute', top: -100, right: -100, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: -80, left: -80, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139, 92, 246, 0.2) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', top: '50%', right: '15%', width: 4, height: 80, background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.3), transparent)', borderRadius: 2 }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <Title level={1} style={{ color: '#fff', margin: 0, marginBottom: 12, fontWeight: 700, fontSize: 36 }}>
            数字员工系统
          </Title>
          <Text style={{ color: 'rgba(255, 255, 255, 0.75)', fontSize: 18, display: 'block', marginBottom: 8 }}>
            智能估算 · 精准管控 · 让每一分项目成本清晰可见
          </Text>
          <div style={{ display: 'flex', gap: 24, marginTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981' }} />
              <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 13 }}>AI 智能分析</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3B82F6' }} />
              <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 13 }}>OCR 文档识别</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#8B5CF6' }} />
              <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 13 }}>实时成本监控</Text>
            </div>
          </div>
        </div>
      </div>

      {/* 功能入口卡片 */}
      <Row gutter={[24, 24]}>
        {featureCards.map((card) => (
          <Col xs={24} lg={8} key={card.path}>
            <FeatureCard {...card} navigate={navigate} />
          </Col>
        ))}
      </Row>
    </div>
  )
}