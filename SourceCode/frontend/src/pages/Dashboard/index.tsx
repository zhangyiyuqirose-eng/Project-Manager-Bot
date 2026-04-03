import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Row, Col, Statistic, Button, Spin, Empty } from 'antd'
import {
  ProjectOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  AlertOutlined,
  WarningOutlined,
  FireOutlined,
  CalculatorOutlined,
  DollarOutlined,
  MonitorOutlined,
} from '@ant-design/icons'
import { dashboardApi } from '@/api'
import type { DashboardStats } from '@/types'

interface StatsCardProps {
  title: string
  value: number
  icon: React.ReactNode
  color: string
  suffix?: string
}

function StatsCard({ title, value, icon, color, suffix }: StatsCardProps) {
  return (
    <Card>
      <Statistic
        title={
          <span style={{ fontSize: 14, color: '#666' }}>
            {icon}
            <span style={{ marginLeft: 8 }}>{title}</span>
          </span>
        }
        value={value}
        suffix={suffix}
        valueStyle={{ color, fontSize: 28, fontWeight: 600 }}
      />
    </Card>
  )
}

interface FeatureCardProps {
  title: string
  description: string
  icon: React.ReactNode
  color: string
  path: string
  navigate: (path: string) => void
}

function FeatureCard({ title, description, icon, color, path, navigate }: FeatureCardProps) {
  return (
    <Card
      hoverable
      style={{ height: '100%' }}
      styles={{
        body: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: 24,
        },
      }}
      onClick={() => navigate(path)}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: `${color}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <span style={{ fontSize: 32, color }}>{icon}</span>
      </div>
      <h3 style={{ fontSize: 18, marginBottom: 8, fontWeight: 600 }}>{title}</h3>
      <p style={{ color: '#666', textAlign: 'center', margin: 0 }}>{description}</p>
    </Card>
  )
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    setLoading(true)
    try {
      const response = await dashboardApi.getStats()
      setStats(response.data.data as DashboardStats)
    } catch {
      // Error is handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" tip="加载中..." />
      </div>
    )
  }

  if (!stats) {
    return (
      <Empty
        description="暂无数据"
        style={{ margin: '100px 0' }}
      >
        <Button type="primary" onClick={fetchStats}>
          重新加载
        </Button>
      </Empty>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      {/* 项目统计卡片 */}
      <h2 style={{ marginBottom: 16, fontSize: 18, fontWeight: 600 }}>项目统计</h2>
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        <Col xs={24} sm={8}>
          <StatsCard
            title="项目总数"
            value={stats.totalProjects}
            icon={<ProjectOutlined />}
            color="#1890ff"
          />
        </Col>
        <Col xs={24} sm={8}>
          <StatsCard
            title="进行中"
            value={stats.ongoingProjects}
            icon={<ClockCircleOutlined />}
            color="#52c41a"
          />
        </Col>
        <Col xs={24} sm={8}>
          <StatsCard
            title="已完成"
            value={stats.completedProjects}
            icon={<CheckCircleOutlined />}
            color="#722ed1"
          />
        </Col>
      </Row>

      {/* 成本健康监控卡片 */}
      <h2 style={{ marginBottom: 16, fontSize: 18, fontWeight: 600 }}>成本健康监控</h2>
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        <Col xs={24} sm={8}>
          <Card
            style={{ borderLeft: '4px solid #ff4d4f' }}
          >
            <Statistic
              title={
                <span style={{ fontSize: 14, color: '#666' }}>
                  <AlertOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
                  异常项目
                </span>
              }
              value={stats.costAbnormalCount}
              valueStyle={{ color: '#ff4d4f', fontSize: 28, fontWeight: 600 }}
              suffix="个"
            />
            <p style={{ color: '#999', fontSize: 12, marginTop: 8, marginBottom: 0 }}>
              成本偏差超过预警阈值
            </p>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            style={{ borderLeft: '4px solid #faad14' }}
          >
            <Statistic
              title={
                <span style={{ fontSize: 14, color: '#666' }}>
                  <WarningOutlined style={{ color: '#faad14', marginRight: 8 }} />
                  高风险预警
                </span>
              }
              value={stats.highRiskCount}
              valueStyle={{ color: '#faad14', fontSize: 28, fontWeight: 600 }}
              suffix="个"
            />
            <p style={{ color: '#999', fontSize: 12, marginTop: 8, marginBottom: 0 }}>
              成本消耗速度异常
            </p>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            style={{ borderLeft: '4px solid #ff7a45' }}
          >
            <Statistic
              title={
                <span style={{ fontSize: 14, color: '#666' }}>
                  <FireOutlined style={{ color: '#ff7a45', marginRight: 8 }} />
                  即将燃尽
                </span>
              }
              value={stats.upcomingBurnout?.burnoutDate || '-'}
              valueStyle={{ color: '#ff7a45', fontSize: 20, fontWeight: 600 }}
            />
            <p style={{ color: '#999', fontSize: 12, marginTop: 8, marginBottom: 0 }}>
              {stats.upcomingBurnout?.projectName || '暂无即将燃尽项目'}
            </p>
          </Card>
        </Col>
      </Row>

      {/* 三大功能入口卡片 */}
      <h2 style={{ marginBottom: 16, fontSize: 18, fontWeight: 600 }}>功能入口</h2>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <FeatureCard
            title="实施成本预估"
            description="基于功能点分析法，智能评估项目实施成本，支持复杂度、系统数、流程阶段等多维度配置"
            icon={<CalculatorOutlined />}
            color="#1890ff"
            path="/cost-estimate/upload"
            navigate={navigate}
          />
        </Col>
        <Col xs={24} sm={8}>
          <FeatureCard
            title="成本消耗预估"
            description="实时追踪项目成本消耗，预估燃尽时间，支持团队成员调整与人力成本优化"
            icon={<DollarOutlined />}
            color="#52c41a"
            path="/cost-consumption/input"
            navigate={navigate}
          />
        </Col>
        <Col xs={24} sm={8}>
          <FeatureCard
            title="成本偏差监控"
            description="AI智能识别项目进度与成本偏差，提供风险预警与优化建议，确保项目成本可控"
            icon={<MonitorOutlined />}
            color="#722ed1"
            path="/cost-deviation/input"
            navigate={navigate}
          />
        </Col>
      </Row>
    </div>
  )
}