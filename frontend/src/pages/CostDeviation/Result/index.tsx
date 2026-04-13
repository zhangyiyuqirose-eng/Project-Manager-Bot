import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Card,
  Steps,
  Button,
  Typography,
  message,
  Spin,
  Row,
  Col,
  Table,
  Tag,
  Progress,
} from 'antd'
import {
  EditOutlined,
  BarChartOutlined,
  DownloadOutlined,
  ArrowLeftOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  MonitorOutlined,
  DollarOutlined,
  ProjectOutlined,
  AlertOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { Line, Column } from '@ant-design/charts'
import { deviationApi } from '@/api'
import type { CostDeviation, StageCost, TeamCost } from '@/types'

const { Title, Text } = Typography

// 步骤条配置
const stepItems = [
  {
    title: '信息录入',
    description: '上传截图与识别',
    icon: <EditOutlined />,
  },
  {
    title: '偏差分析',
    description: '成本偏差监控',
    icon: <BarChartOutlined />,
  },
]

// 团队列表
const teamList = ['产品', 'UI', '研发', '测试', '项目管理']

// 阶段列表
const stageList = ['需求', '设计', '开发', '技术测试', '性能测试', '投产']

// 统计卡片组件
interface StatCardProps {
  title: string
  value: number | string
  suffix?: string
  precision?: number
  icon: React.ReactNode
  color: string
  gradient: string
  status?: 'success' | 'warning' | 'error' | 'normal'
  tagText?: string
}

function StatCard({ title, value, suffix, precision, icon, color, gradient, status, tagText }: StatCardProps) {
  return (
    <Card
      style={{
        borderRadius: 16,
        border: '1px solid #f1f5f9',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          background: gradient,
          padding: '20px 16px',
          borderRadius: 12,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 22, color: '#fff' }}>{icon}</span>
        </div>
        <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 12 }}>{title}</Text>
      </div>
      <div style={{ textAlign: 'center' }}>
        <Text
          strong
          style={{
            fontSize: 28,
            color,
            fontWeight: 700,
          }}
        >
          {typeof value === 'number' && precision ? value.toFixed(precision) : value}
        </Text>
        {suffix && (
          <Text type="secondary" style={{ fontSize: 13, marginLeft: 4 }}>
            {suffix}
          </Text>
        )}
        {tagText && (
          <Tag
            style={{
              marginTop: 8,
              borderRadius: 8,
              background: status === 'error' ? '#EF4444' : status === 'warning' ? '#F59E0B' : '#10B981',
              color: '#fff',
              border: 'none',
            }}
          >
            {tagText}
          </Tag>
        )}
      </div>
    </Card>
  )
}

export default function CostDeviationResult() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('projectId')

  const [currentStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  // 结果数据
  const [result, setResult] = useState<CostDeviation | null>(null)

  // 加载结果数据
  useEffect(() => {
    const loadResult = async () => {
      if (!projectId) {
        message.warning('缺少项目ID')
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const response = await deviationApi.getResult(Number(projectId))
        if (response.data.code === 0 || response.data.code === 200) {
          setResult(response.data.data)
        }
      } catch {
        message.error('获取结果数据失败')
      } finally {
        setLoading(false)
      }
    }

    loadResult()
  }, [projectId])

  // 导出报告
  const handleExportReport = async () => {
    if (!projectId) return

    setExporting(true)
    try {
      const response = await deviationApi.exportReport(Number(projectId))
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `成本偏差分析报告_${projectId}_${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      message.success('报告导出成功')
    } catch {
      message.error('报告导出失败')
    } finally {
      setExporting(false)
    }
  }

  // 判断偏差状态
  const getDeviationStatus = (deviation: number): { status: 'success' | 'warning' | 'error', text: string, color: string } => {
    if (deviation <= 5) {
      return { status: 'success', text: '正常', color: '#10B981' }
    } else if (deviation <= 15) {
      return { status: 'warning', text: '轻度偏差', color: '#F59E0B' }
    } else {
      return { status: 'error', text: '严重偏差', color: '#EF4444' }
    }
  }

  // 成本消耗与任务进度对比条形图配置
  const progressComparisonConfig = {
    data: [
      {
        type: '成本消耗',
        value: result?.currentCostConsumption || 0,
      },
      {
        type: '预期消耗',
        value: (result?.totalContractAmount || 0) * (result?.taskProgress || 0) / 100,
      },
      {
        type: '任务进度',
        value: result?.taskProgress || 0,
      },
    ],
    xField: 'type',
    yField: 'value',
    color: ({ type }: { type: string }) => {
      if (type === '成本消耗') return '#EF4444'
      if (type === '预期消耗') return '#3B82F6'
      return '#10B981'
    },
    label: {
      position: 'top' as const,
      style: {
        fill: '#1D2129',
        fontSize: 12,
      },
      formatter: ({ type, value }: { type: string; value: number }) => {
        if (type === '任务进度') return `${value.toFixed(1)}%`
        return `${value.toFixed(2)}万`
      },
    },
    meta: {
      type: { alias: '类型' },
      value: { alias: '值' },
    },
    columnStyle: {
      radius: [8, 8, 0, 0],
    },
  }

  // 各阶段成本偏差折线图配置
  const stageLineConfig = {
    data: [
      ...(result?.expectedStages?.map((item) => ({
        stage: item.stage,
        type: '预期占比',
        value: item.expectedRatio * 100,
      })) || stageList.map((stage, index) => ({
        stage,
        type: '预期占比',
        value: [15, 20, 35, 15, 5, 10][index],
      }))),
      ...(result?.actualStages?.map((item) => ({
        stage: item.stage,
        type: '实际占比',
        value: item.actualRatio * 100,
      })) || []),
    ],
    xField: 'stage',
    yField: 'value',
    seriesField: 'type',
    color: ['#3B82F6', '#EF4444'],
    legend: {
      position: 'top' as const,
    },
    smooth: true,
    point: {
      size: 4,
      shape: 'circle',
    },
    label: {
      position: 'top' as const,
      style: {
        fontSize: 10,
      },
      formatter: ({ value }: { value: number }) => `${value.toFixed(1)}%`,
    },
    meta: {
      stage: { alias: '阶段' },
      value: { alias: '占比(%)' },
      type: { alias: '类型' },
    },
  }

  // 各团队成本双柱形图配置
  const teamColumnConfig = {
    data: [
      ...((result?.teamCosts?.map((item) => [
        {
          team: item.team,
          type: '预期成本',
          value: item.expectedCost,
        },
        {
          team: item.team,
          type: '实际成本',
          value: item.actualCost,
        },
      ])) || teamList.map((team) => [
        {
          team,
          type: '预期成本',
          value: 0,
        },
        {
          team,
          type: '实际成本',
          value: 0,
        },
      ])).flat(),
    ],
    xField: 'team',
    yField: 'value',
    seriesField: 'type',
    isGroup: true,
    color: ['#3B82F6', '#EF4444'],
    legend: {
      position: 'top' as const,
    },
    label: {
      position: 'top' as const,
      style: {
        fontSize: 10,
      },
      formatter: ({ value }: { value: number }) => `${value.toFixed(2)}万`,
    },
    meta: {
      team: { alias: '团队' },
      value: { alias: '成本(万元)' },
      type: { alias: '类型' },
    },
    columnStyle: {
      radius: [8, 8, 0, 0],
    },
  }

  // 阶段成本详细表格列配置
  const stageColumns: ColumnsType<StageCost> = [
    {
      title: '阶段',
      dataIndex: 'stage',
      key: 'stage',
      width: 100,
      render: (value: string) => (
        <Text style={{ fontWeight: 500, color: '#0f172a' }}>{value}</Text>
      ),
    },
    {
      title: '预期成本(万)',
      dataIndex: 'expectedCost',
      key: 'expectedCost',
      width: 110,
      render: (value: number) => (
        <Text style={{ color: '#3B82F6' }}>{value?.toFixed(2) || '-'}</Text>
      ),
    },
    {
      title: '预期占比',
      dataIndex: 'expectedRatio',
      key: 'expectedRatio',
      width: 100,
      render: (value: number) => (
        <Progress
          percent={(value || 0) * 100}
          size="small"
          strokeColor="#3B82F6"
          format={(percent) => `${percent?.toFixed(1)}%`}
        />
      ),
    },
    {
      title: '实际成本(万)',
      dataIndex: 'actualCost',
      key: 'actualCost',
      width: 110,
      render: (value: number) => (
        <Text style={{ color: '#EF4444' }}>{value?.toFixed(2) || '-'}</Text>
      ),
    },
    {
      title: '实际占比',
      dataIndex: 'actualRatio',
      key: 'actualRatio',
      width: 100,
      render: (value: number) => (
        <Progress
          percent={(value || 0) * 100}
          size="small"
          strokeColor="#EF4444"
          format={(percent) => `${percent?.toFixed(1)}%`}
        />
      ),
    },
    {
      title: '偏差',
      dataIndex: 'deviation',
      key: 'deviation',
      width: 100,
      render: (value: number) => {
        const status = getDeviationStatus(value || 0)
        return (
          <Tag
            style={{
              borderRadius: 8,
              background: `${status.color}15`,
              color: status.color,
              border: 'none',
            }}
          >
            {value?.toFixed(1)}%
          </Tag>
        )
      },
    },
  ]

  // 团队成本详细表格列配置
  const teamColumns: ColumnsType<TeamCost> = [
    {
      title: '团队',
      dataIndex: 'team',
      key: 'team',
      width: 100,
      render: (value: string) => (
        <Text style={{ fontWeight: 500, color: '#0f172a' }}>{value}</Text>
      ),
    },
    {
      title: '预期成本(万)',
      dataIndex: 'expectedCost',
      key: 'expectedCost',
      width: 120,
      render: (value: number) => (
        <Text style={{ color: '#3B82F6' }}>{value?.toFixed(2) || '-'}</Text>
      ),
    },
    {
      title: '实际成本(万)',
      dataIndex: 'actualCost',
      key: 'actualCost',
      width: 120,
      render: (value: number) => (
        <Text style={{ color: '#EF4444' }}>{value?.toFixed(2) || '-'}</Text>
      ),
    },
    {
      title: '偏差',
      dataIndex: 'deviation',
      key: 'deviation',
      width: 100,
      render: (value: number) => {
        const status = getDeviationStatus(value || 0)
        return (
          <Tag
            style={{
              borderRadius: 8,
              background: `${status.color}15`,
              color: status.color,
              border: 'none',
            }}
          >
            {value?.toFixed(1)}%
          </Tag>
        )
      },
    },
  ]

  if (loading) {
    return (
      <div className="page-container">
        <Card style={{ borderRadius: 16 }}>
          <Spin size="large" tip="加载分析结果..." />
        </Card>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="page-container">
        <Card style={{ borderRadius: 16, marginBottom: 24 }}>
          <Steps current={currentStep} items={stepItems} />
        </Card>
        <Card
          style={{
            borderRadius: 20,
            border: '1px solid #f1f5f9',
            textAlign: 'center',
            padding: 48,
          }}
        >
          <MonitorOutlined style={{ fontSize: 48, color: '#64748b', marginBottom: 16 }} />
          <Title level={4} style={{ marginBottom: 8 }}>暂无分析结果</Title>
          <Text type="secondary" style={{ marginBottom: 24 }}>
            请先完成信息录入
          </Text>
          <Button
            type="primary"
            size="large"
            onClick={() => navigate('/cost-deviation/input')}
            style={{
              borderRadius: 12,
              height: 44,
              background: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
              border: 'none',
            }}
          >
            前往信息录入
          </Button>
        </Card>
      </div>
    )
  }

  // 偏差状态判断
  const deviationStatus = getDeviationStatus(result.costDeviation)

  return (
    <div className="page-container">
      {/* 步骤条 */}
      <Card
        style={{
          borderRadius: 16,
          marginBottom: 24,
          border: '1px solid #f1f5f9',
        }}
      >
        <Steps current={currentStep} items={stepItems} style={{ marginBottom: 8 }} />
      </Card>

      {/* 功能介绍区域 */}
      <div
        style={{
          background: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
          borderRadius: 20,
          padding: '32px 40px',
          marginBottom: 24,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.1)' }} />
        <div style={{ position: 'absolute', bottom: -80, right: 100, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.05)' }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 24 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BarChartOutlined style={{ fontSize: 32, color: '#fff' }} />
          </div>
          <div>
            <Title level={3} style={{ color: '#fff', margin: 0, marginBottom: 8 }}>
              成本偏差分析结果
            </Title>
            <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 15 }}>
              多维度成本偏差分析，AI智能识别并提供调整建议
            </Text>
          </div>
        </div>
      </div>

      {/* 核心指标卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <StatCard
            title="合同金额"
            value={result.totalContractAmount}
            suffix="万元"
            precision={2}
            icon={<DollarOutlined />}
            color="#3B82F6"
            gradient="linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%)"
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="成本消耗"
            value={result.currentCostConsumption}
            suffix="万元"
            precision={2}
            icon={<AlertOutlined />}
            color="#EF4444"
            gradient="linear-gradient(135deg, #EF4444 0%, #F87171 100%)"
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="任务进度"
            value={result.taskProgress}
            suffix="%"
            precision={1}
            icon={<ProjectOutlined />}
            color="#10B981"
            gradient="linear-gradient(135deg, #10B981 0%, #34D399 100%)"
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="成本偏差"
            value={result.costDeviation}
            suffix="%"
            precision={1}
            icon={<ThunderboltOutlined />}
            color={deviationStatus.color}
            gradient="linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)"
            status={deviationStatus.status}
            tagText={deviationStatus.text}
          />
        </Col>
      </Row>

      {/* 偏差预警提示 */}
      {result.costDeviation > 15 && (
        <Card
          style={{
            borderRadius: 16,
            marginBottom: 24,
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(248, 113, 113, 0.1) 100%)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: '#EF4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ExclamationCircleOutlined style={{ fontSize: 24, color: '#fff' }} />
            </div>
            <div>
              <Text strong style={{ fontSize: 16, color: '#EF4444' }}>成本偏差预警</Text>
              <br />
              <Text type="secondary">当前成本偏差 {result.costDeviation.toFixed(1)}% 已超过15%阈值，建议立即采取措施控制成本</Text>
            </div>
          </div>
        </Card>
      )}
      {result.costDeviation > 5 && result.costDeviation <= 15 && (
        <Card
          style={{
            borderRadius: 16,
            marginBottom: 24,
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(251, 191, 36, 0.1) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: '#F59E0B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ExclamationCircleOutlined style={{ fontSize: 24, color: '#fff' }} />
            </div>
            <div>
              <Text strong style={{ fontSize: 16, color: '#F59E0B' }}>成本偏差提醒</Text>
              <br />
              <Text type="secondary">当前成本偏差 {result.costDeviation.toFixed(1)}% 处于轻度偏差范围，请关注成本控制</Text>
            </div>
          </div>
        </Card>
      )}
      {result.costDeviation <= 5 && (
        <Card
          style={{
            borderRadius: 16,
            marginBottom: 24,
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(52, 211, 153, 0.1) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: '#10B981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircleOutlined style={{ fontSize: 24, color: '#fff' }} />
            </div>
            <div>
              <Text strong style={{ fontSize: 16, color: '#10B981' }}>成本控制良好</Text>
              <br />
              <Text type="secondary">当前成本偏差在正常范围内，项目成本控制符合预期</Text>
            </div>
          </div>
        </Card>
      )}

      {/* 成本消耗与任务进度对比条形图 */}
      <Card
        style={{
          borderRadius: 20,
          marginBottom: 24,
          border: '1px solid #f1f5f9',
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <Title level={4} style={{ marginBottom: 4, fontWeight: 600 }}>
            <BarChartOutlined style={{ marginRight: 8, color: '#3B82F6' }} />
            成本消耗与任务进度对比
          </Title>
          <Text type="secondary">对比当前成本消耗与任务进度对应的预期成本消耗，判断是否存在超前或滞后消耗</Text>
        </div>
        <Column {...progressComparisonConfig} height={200} />
      </Card>

      {/* 各阶段成本偏差折线图 */}
      <Card
        style={{
          borderRadius: 20,
          marginBottom: 24,
          border: '1px solid #f1f5f9',
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <Title level={4} style={{ marginBottom: 4, fontWeight: 600 }}>
            <MonitorOutlined style={{ marginRight: 8, color: '#8B5CF6' }} />
            各阶段成本偏差分析
          </Title>
          <Text type="secondary">横轴为项目各阶段，双折线分别展示预期成本占比与实际成本占比</Text>
        </div>
        <Row gutter={24}>
          <Col xs={24} lg={16}>
            <Line {...stageLineConfig} height={300} />
          </Col>
          <Col xs={24} lg={8}>
            <Card
              size="small"
              title={
                <Text strong style={{ fontSize: 14 }}>
                  阶段偏差汇总
                </Text>
              }
              style={{ borderRadius: 12, border: '1px solid #f1f5f9' }}
            >
              {result.actualStages?.map((stage) => {
                const status = getDeviationStatus(stage.deviation)
                return (
                  <div
                    key={stage.stage}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 0',
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    <Text style={{ fontWeight: 500 }}>{stage.stage}</Text>
                    <Tag
                      style={{
                        borderRadius: 8,
                        background: `${status.color}15`,
                        color: status.color,
                        border: 'none',
                      }}
                    >
                      偏差 {stage.deviation.toFixed(1)}%
                    </Tag>
                  </div>
                )
              })}
            </Card>
          </Col>
        </Row>
      </Card>

      {/* 各团队成本双柱形图 */}
      <Card
        style={{
          borderRadius: 20,
          marginBottom: 24,
          border: '1px solid #f1f5f9',
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <Title level={4} style={{ marginBottom: 4, fontWeight: 600 }}>
            <ProjectOutlined style={{ marginRight: 8, color: '#F59E0B' }} />
            各团队成本对比分析
          </Title>
          <Text type="secondary">横轴为各团队，双柱分别展示预期成本与实际成本</Text>
        </div>
        <Row gutter={24}>
          <Col xs={24} lg={16}>
            <Column {...teamColumnConfig} height={300} />
          </Col>
          <Col xs={24} lg={8}>
            <Card
              size="small"
              title={
                <Text strong style={{ fontSize: 14 }}>
                  团队偏差汇总
                </Text>
              }
              style={{ borderRadius: 12, border: '1px solid #f1f5f9' }}
            >
              {result.teamCosts?.map((team) => {
                const status = getDeviationStatus(team.deviation)
                return (
                  <div
                    key={team.team}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 0',
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    <Text style={{ fontWeight: 500 }}>{team.team}</Text>
                    <Tag
                      style={{
                        borderRadius: 8,
                        background: `${status.color}15`,
                        color: status.color,
                        border: 'none',
                      }}
                    >
                      偏差 {team.deviation.toFixed(1)}%
                    </Tag>
                  </div>
                )
              })}
            </Card>
          </Col>
        </Row>
      </Card>

      {/* AI人员调整建议 */}
      {result.aiSuggestion && (
        <Card
          style={{
            borderRadius: 20,
            marginBottom: 24,
            border: '1px solid #f1f5f9',
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <Title level={4} style={{ marginBottom: 4, fontWeight: 600 }}>
              <ThunderboltOutlined style={{ marginRight: 8, color: '#8B5CF6' }} />
              AI人员调整建议
            </Title>
            <Text type="secondary">基于成本偏差分析，AI智能生成的优化建议</Text>
          </div>

          <Card
            style={{
              borderRadius: 12,
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <InfoCircleOutlined style={{ color: '#8B5CF6', fontSize: 18, marginTop: 2 }} />
              <Text style={{ color: '#475569', lineHeight: 1.6 }}>{result.aiSuggestion}</Text>
            </div>
          </Card>
        </Card>
      )}

      {/* 详细成本分析表格 */}
      <Card
        style={{
          borderRadius: 20,
          marginBottom: 24,
          border: '1px solid #f1f5f9',
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <Title level={4} style={{ marginBottom: 4, fontWeight: 600 }}>
            <DollarOutlined style={{ marginRight: 8, color: '#10B981' }} />
            详细成本分析
          </Title>
          <Text type="secondary">各阶段与团队的成本偏差详细数据</Text>
        </div>

        <Row gutter={[24, 24]}>
          <Col xs={24} lg={12}>
            <Card
              size="small"
              title={
                <Text strong style={{ fontSize: 14 }}>
                  阶段成本明细
                </Text>
              }
              style={{ borderRadius: 12, border: '1px solid #f1f5f9' }}
            >
              <Table
                columns={stageColumns}
                dataSource={result.actualStages || []}
                rowKey="stage"
                pagination={false}
                size="small"
              />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card
              size="small"
              title={
                <Text strong style={{ fontSize: 14 }}>
                  团队成本明细
                </Text>
              }
              style={{ borderRadius: 12, border: '1px solid #f1f5f9' }}
            >
              <Table
                columns={teamColumns}
                dataSource={result.teamCosts || []}
                rowKey="team"
                pagination={false}
                size="small"
              />
            </Card>
          </Col>
        </Row>
      </Card>

      {/* 操作按钮 */}
      <Card
        style={{
          borderRadius: 16,
          border: '1px solid #f1f5f9',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            size="large"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(`/cost-deviation/input?projectId=${projectId}`)}
            style={{ borderRadius: 12, height: 44 }}
          >
            返回录入
          </Button>
          <Button
            type="primary"
            size="large"
            icon={<DownloadOutlined />}
            onClick={handleExportReport}
            loading={exporting}
            style={{
              borderRadius: 12,
              height: 44,
              background: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
              border: 'none',
              fontWeight: 600,
            }}
          >
            导出报告
          </Button>
        </div>
      </Card>
    </div>
  )
}