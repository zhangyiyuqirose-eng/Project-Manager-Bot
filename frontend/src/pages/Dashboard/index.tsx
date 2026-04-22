import { useNavigate } from 'react-router-dom'
import { Card, Typography, Button, Tag, Space, Divider, Empty, Spin } from 'antd'
import {
  CalculatorOutlined,
  DollarOutlined,
  MonitorOutlined,
  ArrowRightOutlined,
  ProjectOutlined,
  ClockCircleOutlined,
  TagOutlined,
  TeamOutlined,
  DollarCircleOutlined,
  CalendarOutlined,
  MoreOutlined,
} from '@ant-design/icons'
import { useState, useEffect, useCallback } from 'react'
import { projectApi } from '@/api'

const { Title, Text, Paragraph } = Typography

// 项目类型接口
interface Project {
  id: number
  projectId: string
  projectCode: string
  projectName: string
  projectType: string
  status: string
  contractAmount: number
  createdAt: string
}

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

// 项目卡片组件
function ProjectCard({ project }: { project: Project }) {
  const getStatusColor = (status: string) => {
    const statusMap: Record<string, string> = {
      '实施中': 'processing',
      '已完成': 'success',
      '已暂停': 'warning',
      '已取消': 'error',
      'ongoing': 'processing',
      'completed': 'success',
      'paused': 'warning',
      'cancelled': 'error'
    }
    return statusMap[status] || 'default'
  }

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'ongoing': '进行中',
      'completed': '已完成',
      'paused': '已暂停',
      'cancelled': '已取消'
    }
    return statusMap[status] || status
  }

  const getProjectTypeText = (type: string) => {
    const typeMap: Record<string, string> = {
      'implementation': '实施项目',
      'software': '软件项目',
      'maintenance': '维护项目'
    }
    return typeMap[type] || type
  }

  return (
    <Card
      style={{
        borderRadius: 16,
        border: '1px solid var(--color-border-light)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 4 }}>{project.projectName}</Text>
          <Text type="secondary" style={{ fontSize: 14 }}>项目编号: {project.projectCode}</Text>
        </div>
        <Tag color={getStatusColor(project.status)}>{getStatusText(project.status)}</Tag>
      </div>
      
      <Divider style={{ margin: '12px 0' }} />
      
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TagOutlined style={{ color: 'var(--color-text-secondary)', fontSize: 14 }} />
          <Text style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
            项目类型: {getProjectTypeText(project.projectType)}
          </Text>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <DollarCircleOutlined style={{ color: 'var(--color-text-secondary)', fontSize: 14 }} />
          <Text style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
            合同金额: ¥{(project.contractAmount || 0).toLocaleString()}
          </Text>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarOutlined style={{ color: 'var(--color-text-secondary)', fontSize: 14 }} />
          <Text style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
            创建时间: {project.createdAt ? new Date(project.createdAt).toLocaleString('zh-CN') : '未知'}
          </Text>
        </div>
      </Space>
    </Card>
  )
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
              cursor: 'default',
            }}
            onClick={(e) => e.stopPropagation()}
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
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  // 获取项目列表
  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true)
      const response = await projectApi.getList({ pageSize: 10 })
      if (response.data.code === 0 || response.data.code === 200) {
        const projectList = response.data.data || []
        // 排序：实施中的在前，然后按创建时间倒序
        const sortedProjects = projectList.sort((a: Project, b: Project) => {
          // 先按状态排序：实施中 > 其他
          if (a.status === '实施中' && b.status !== '实施中') return -1
          if (a.status !== '实施中' && b.status === '实施中') return 1
          // 再按创建时间倒序
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })
        setProjects(sortedProjects)
      }
    } catch (error) {
      console.error('获取项目列表失败:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // 初始加载
  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

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
    <div className="page-container" style={{ maxWidth: 1400, margin: '0 auto', width: '100%', padding: '24px' }}>
      {/* 项目信息展示 */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ProjectOutlined style={{ fontSize: 20, color: '#3B82F6' }} />
            <Title level={4} style={{ margin: 0, fontWeight: 600 }}>项目信息</Title>
          </div>
          <Button
            type="text"
            icon={<MoreOutlined />}
            onClick={() => navigate('/project/list')}
            style={{ color: '#3B82F6' }}
          >
            查看更多
          </Button>
        </div>
        
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <Spin size="large" />
          </div>
        ) : projects.length === 0 ? (
          <Empty description="暂无项目数据" />
        ) : (
          <div style={{ display: 'flex', gap: 24, width: '100%' }}>
            {projects.slice(0, 3).map((project) => (
              <div key={project.id} style={{ flex: 1, minWidth: 300 }}>
                <ProjectCard project={project} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 功能入口卡片 - 均匀分布 */}
      <div style={{ display: 'flex', gap: 24, width: '100%' }}>
        {featureCards.map((card) => (
          <div key={card.path} style={{ flex: 1, minWidth: 300 }}>
            <FeatureCard {...card} navigate={navigate} />
          </div>
        ))}
      </div>
    </div>
  )
}