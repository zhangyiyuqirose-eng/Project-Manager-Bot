import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Card,
  Steps,
  Tabs,
  Button,
  Typography,
  message,
  Spin,
  Row,
  Col,
  Table,
  Tag,
  Progress,
  Space,
  Tooltip,
} from 'antd'
import {
  FileTextOutlined,
  SettingOutlined,
  FileSearchOutlined,
  BarChartOutlined,
  ReloadOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ArrowLeftOutlined,
  RocketOutlined,
  RiseOutlined,
  TeamOutlined,
  DashboardOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { Pie, Column } from '@ant-design/charts'
import { estimateApi } from '@/api'
import type {
  EstimateResult,
  StageBreakdown,
  CalculationTrace,
} from '@/types'

const { Title, Text } = Typography

// 步骤条配置（4步）
const stepItems = [
  {
    title: '文件上传',
    description: '上传需求文档',
    icon: <FileTextOutlined />,
  },
  {
    title: '参数配置',
    description: '配置计算参数',
    icon: <SettingOutlined />,
  },
  {
    title: '文档解析结果',
    description: '查看功能点详情',
    icon: <FileSearchOutlined />,
  },
  {
    title: '结果展示',
    description: '查看成本预估',
    icon: <BarChartOutlined />,
  },
]

// 统计卡片组件
interface StatCardProps {
  title: string
  value: number | string
  suffix?: string
  precision?: number
  icon: React.ReactNode
  color: string
  gradient: string
}

function StatCard({ title, value, suffix, precision, icon, color, gradient }: StatCardProps) {
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
          padding: '24px 20px',
          borderRadius: 12,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 24, color: '#fff' }}>{icon}</span>
        </div>
        <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 13 }}>{title}</Text>
      </div>
      <div style={{ textAlign: 'center' }}>
        <Text
          strong
          style={{
            fontSize: 32,
            color,
            fontWeight: 700,
          }}
        >
          {typeof value === 'number' && precision ? value.toFixed(precision) : value}
        </Text>
        {suffix && (
          <Text type="secondary" style={{ fontSize: 14, marginLeft: 4 }}>
            {suffix}
          </Text>
        )}
      </div>
    </Card>
  )
}

export default function CostEstimateResult() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('projectId')

  const [currentStep] = useState(3)
  const [loading, setLoading] = useState(true)
  const [recalculating, setRecalculating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  // 结果数据
  const [result, setResult] = useState<EstimateResult | null>(null)

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
        const response = await estimateApi.getResult(Number(projectId))
        if (response.data.code === 0 || response.data.code === 200) {
          const data = response.data.data
          // 转换后端数据格式为前端期望的格式
          const transformedResult: EstimateResult = {
            projectId: Number(projectId),
            totalManDay: data.totalManDay || 0,
            totalCost: data.totalCost || 0,
            moduleCount: data.moduleCount || 0,
            manMonth: data.manMonth || 0,
            // 转换 stageDetail -> stageBreakdown
            stageBreakdown: (data.stageDetail || []).map((stage: any) => ({
              stage: stage.stage,
              workdays: stage.manDays || 0,
              cost: stage.cost || 0,
              ratio: (stage.percentage || 0) / 100
            })),
            // 转换 teamDetail -> teamBreakdown
            teamBreakdown: (data.teamDetail || []).map((team: any) => ({
              team: team.level || team.team,
              workdays: team.manDays || 0,
              cost: team.totalCost || team.cost || 0,
              ratio: 0
            })),
            // 转换 calcTrace -> calculationTrace
            calculationTrace: (data.calcTrace || []).map((trace: any, index: number) => ({
              functionName: trace.step || trace.functionName || `步骤${index + 1}`,
              complexityBase: trace.input?.complexityConfig?.medium || 1.5,
              systemCoefficient: 1.0,
              processCoefficient: 1.0,
              techStackCoefficient: 1.3,
              managementCoefficient: 0.15,
              formula: trace.formula || '',
              result: trace.output?.totalManDay || trace.output?.totalCost || 0,
              timestamp: new Date().toISOString()
            }))
          }
          setResult(transformedResult)
        }
      } catch {
        message.error('获取结果数据失败')
      } finally {
        setLoading(false)
      }
    }

    loadResult()
  }, [projectId])

  // 重新计算
  const handleRecalculate = async () => {
    if (!projectId) return

    setRecalculating(true)
    try {
      const response = await estimateApi.calculate(Number(projectId))
      if (response.data.code === 0 || response.data.code === 200) {
        message.success('重新计算完成')
        const data = response.data.data
        // 转换后端数据格式为前端期望的格式
        const transformedResult: EstimateResult = {
          projectId: Number(projectId),
          totalManDay: data.totalManDay || 0,
          totalCost: data.totalCost || 0,
          moduleCount: data.moduleCount || 0,
          manMonth: data.manMonth || 0,
          stageBreakdown: (data.stageDetail || []).map((stage: any) => ({
            stage: stage.stage,
            workdays: stage.manDays || 0,
            cost: stage.cost || 0,
            ratio: (stage.percentage || 0) / 100
          })),
          teamBreakdown: (data.teamDetail || []).map((team: any) => ({
            team: team.level || team.team,
            workdays: team.manDays || 0,
            cost: team.totalCost || team.cost || 0,
            ratio: 0
          })),
          calculationTrace: (data.calcTrace || []).map((trace: any, index: number) => ({
            functionName: trace.step || trace.functionName || `步骤${index + 1}`,
            complexityBase: trace.input?.complexityConfig?.medium || 1.5,
            systemCoefficient: 1.0,
            processCoefficient: 1.0,
            techStackCoefficient: 1.3,
            managementCoefficient: 0.15,
            formula: trace.formula || '',
            result: trace.output?.totalManDay || trace.output?.totalCost || 0,
            timestamp: new Date().toISOString()
          }))
        }
        setResult(transformedResult)
      }
    } catch {
      message.error('重新计算失败')
    } finally {
      setRecalculating(false)
    }
  }

  // 导出Excel报告
  const handleExportExcel = async () => {
    if (!projectId) return

    setExporting(true)
    try {
      const response = await estimateApi.exportExcel(Number(projectId))
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `成本预估报告_${projectId}_${new Date().toISOString().slice(0, 10)}.xlsx`
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

  // 团队工作量饼图配置 - 现代专业设计
  const teamPieConfig = {
    appendPadding: [20, 20, 20, 20],
    data: result?.teamBreakdown?.map((item) => ({
      type: item.team,
      value: item.workdays,
    })) || [],
    angleField: 'value',
    colorField: 'type',
    radius: 0.85,
    innerRadius: 0.65,
    // 现代渐变色方案
    color: ['#667EEA', '#764BA2', '#F093FB', '#F5576C', '#4FACFE', '#00F2FE'],
    // 外部标签带引导线
    label: {
      type: 'spider' as const,
      formatter: (datum: any) => {
        const total = result?.teamBreakdown?.reduce((sum: number, item: any) => sum + item.workdays, 0) || 1
        const percent = ((datum.value / total) * 100).toFixed(1)
        return `${datum.type}\n${datum.value}天 (${percent}%)`
      },
      style: {
        fontSize: 12,
        fill: '#374151',
        fontWeight: 500,
      },
      labelLine: {
        style: {
          stroke: '#9CA3AF',
          lineWidth: 1,
        },
      },
    },
    // 右侧图例
    legend: {
      position: 'right' as const,
      layout: 'vertical' as const,
      itemName: {
        style: {
          fontSize: 13,
          fill: '#374151',
        },
      },
      itemValue: {
        style: {
          fontSize: 13,
          fill: '#6B7280',
          fontWeight: 600,
        },
        formatter: (text: string, item: any) => {
          const total = result?.teamBreakdown?.reduce((sum: number, i: any) => sum + i.workdays, 0) || 1
          const dataItem = result?.teamBreakdown?.find((i: any) => i.team === item.name)
          const percent = dataItem ? ((dataItem.workdays / total) * 100).toFixed(1) : '0'
          return `${item.value}天 (${percent}%)`
        },
      },
    },
    interactions: [
      { type: 'element-selected' },
      { type: 'element-active' },
      { type: 'pie-statistic-active' },
    ],
    // 中心统计信息
    statistic: {
      title: {
        offsetY: -12,
        style: {
          fontSize: '13px',
          color: '#6B7280',
          fontWeight: 400,
        },
        customHtml: () => '总工作量',
      },
      content: {
        offsetY: 8,
        style: {
          fontSize: '28px',
          color: '#1F2937',
          fontWeight: 700,
        },
        customHtml: () => `${result?.totalManDay?.toFixed(1) || '0'}<span style="font-size:14px;color:#6B7280;font-weight:400"> 人天</span>`,
      },
    },
    // 悬浮状态样式
    state: {
      active: {
        style: (element: any) => {
          return {
            lineWidth: 3,
            stroke: '#fff',
            shadowBlur: 12,
            shadowColor: 'rgba(0, 0, 0, 0.15)',
          }
        },
      },
    },
  }

  // 各阶段工作量柱状图配置
  const stageColumnConfig = {
    data: result?.stageBreakdown?.map((item) => ({
      stage: item.stage,
      workdays: item.workdays,
      cost: item.cost,
    })) || [],
    xField: 'stage',
    yField: 'workdays',
    color: '#3B82F6',
    label: {
      position: 'top' as const,
      style: {
        fill: '#1D2129',
        fontSize: 12,
      },
    },
    meta: {
      stage: { alias: '阶段' },
      workdays: { alias: '人天' },
    },
    columnStyle: {
      radius: [8, 8, 0, 0],
    },
  }

  // 阶段详细分解表格列配置
  const stageColumns: ColumnsType<StageBreakdown> = [
    {
      title: '阶段',
      dataIndex: 'stage',
      key: 'stage',
      width: 120,
      render: (value: string) => {
        const icons: Record<string, string> = {
          '需求分析': '📋',
          '系统设计': '🎨',
          '开发实现': '💻',
          '测试验证': '🧪',
          '部署上线': '🚀',
          '运维保障': '🔧',
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{icons[value] || '📌'}</span>
            <Text style={{ fontWeight: 500 }}>{value}</Text>
          </div>
        )
      },
    },
    {
      title: '人天',
      dataIndex: 'workdays',
      key: 'workdays',
      width: 100,
      render: (value: number) => (
        <Text strong style={{ color: '#3B82F6' }}>{value.toFixed(1)}</Text>
      ),
    },
    {
      title: '成本(万元)',
      dataIndex: 'cost',
      key: 'cost',
      width: 120,
      render: (value: number) => (
        <Text style={{ color: '#EF4444' }}>{value.toFixed(2)}</Text>
      ),
    },
    {
      title: '占比',
      dataIndex: 'ratio',
      key: 'ratio',
      width: 120,
      render: (value: number) => (
        <Progress
          percent={value * 100}
          size="small"
          strokeColor="#3B82F6"
          format={(percent) => `${percent?.toFixed(1)}%`}
        />
      ),
    },
  ]

  // 功能模块详细分析表格列配置
  const moduleColumns: ColumnsType<CalculationTrace> = [
    {
      title: '功能模块',
      dataIndex: 'functionName',
      key: 'functionName',
      width: 150,
      render: (value: string) => (
        <Text style={{ fontWeight: 500, color: '#0f172a' }}>{value}</Text>
      ),
    },
    {
      title: '复杂度基准',
      dataIndex: 'complexityBase',
      key: 'complexityBase',
      width: 100,
      render: (value: number) => (
        <Tag style={{ borderRadius: 8, background: '#3B82F615', color: '#3B82F6', border: 'none' }}>
          {value.toFixed(1)}
        </Tag>
      ),
    },
    {
      title: '系统系数',
      dataIndex: 'systemCoefficient',
      key: 'systemCoefficient',
      width: 80,
      render: (value: number) => (
        <Tag style={{ borderRadius: 8, background: '#8B5CF615', color: '#8B5CF6', border: 'none' }}>
          {value.toFixed(2)}
        </Tag>
      ),
    },
    {
      title: '流程系数',
      dataIndex: 'processCoefficient',
      key: 'processCoefficient',
      width: 80,
      render: (value: number) => (
        <Tag style={{ borderRadius: 8, background: '#10B98115', color: '#10B981', border: 'none' }}>
          {value.toFixed(2)}
        </Tag>
      ),
    },
    {
      title: '技术栈系数',
      dataIndex: 'techStackCoefficient',
      key: 'techStackCoefficient',
      width: 80,
      render: (value: number) => (
        <Tag style={{ borderRadius: 8, background: '#F59E0B15', color: '#F59E0B', border: 'none' }}>
          {value.toFixed(2)}
        </Tag>
      ),
    },
    {
      title: '管理系数',
      dataIndex: 'managementCoefficient',
      key: 'managementCoefficient',
      width: 80,
      render: (value: number) => (
        <Tag style={{ borderRadius: 8, background: '#64748b15', color: '#64748b', border: 'none' }}>
          {value.toFixed(2)}
        </Tag>
      ),
    },
    {
      title: '计算结果(人天)',
      dataIndex: 'result',
      key: 'result',
      width: 120,
      render: (value: number) => (
        <Text strong style={{ color: '#3B82F6', fontSize: 14 }}>
          {value.toFixed(1)}
        </Text>
      ),
    },
  ]

  // 计算轨迹表格列配置
  const traceColumns: ColumnsType<CalculationTrace> = [
    {
      title: '功能模块',
      dataIndex: 'functionName',
      key: 'functionName',
      width: 150,
    },
    {
      title: '计算公式',
      dataIndex: 'formula',
      key: 'formula',
      width: 300,
      render: (value: string) => (
        <Text code style={{ fontSize: 12, color: '#64748b' }}>
          {value}
        </Text>
      ),
    },
    {
      title: '结果',
      dataIndex: 'result',
      key: 'result',
      width: 100,
      render: (value: number) => (
        <Text strong style={{ color: '#3B82F6' }}>{value.toFixed(1)}</Text>
      ),
    },
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (value: string) => (
        <Text type="secondary">{value}</Text>
      ),
    },
  ]

  // 占比合规校验结果
  const complianceChecks = result?.stageBreakdown?.map((stage) => {
    const expectedRanges: Record<string, { min: number; max: number }> = {
      '需求分析': { min: 0.10, max: 0.20 },
      '系统设计': { min: 0.15, max: 0.25 },
      '开发实现': { min: 0.30, max: 0.40 },
      '测试验证': { min: 0.10, max: 0.20 },
      '部署上线': { min: 0.05, max: 0.15 },
      '运维保障': { min: 0.03, max: 0.10 },
    }

    const range = expectedRanges[stage.stage] || { min: 0, max: 1 }
    const isCompliant = stage.ratio >= range.min && stage.ratio <= range.max

    return {
      stage: stage.stage,
      actualRatio: stage.ratio,
      expectedMin: range.min,
      expectedMax: range.max,
      isCompliant,
    }
  }) || []

  if (loading) {
    return (
      <div className="page-container">
        <Card style={{ borderRadius: 16 }}>
          <Spin size="large" tip="加载结果数据..." />
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
          <RocketOutlined style={{ fontSize: 48, color: '#64748b', marginBottom: 16 }} />
          <Title level={4} style={{ marginBottom: 8 }}>暂无结果数据</Title>
          <Text type="secondary" style={{ marginBottom: 24 }}>
            请先完成参数配置并开始计算
          </Text>
          <Button
            type="primary"
            size="large"
            onClick={() => navigate(`/cost-estimate/parse-result?projectId=${projectId}`)}
            style={{
              borderRadius: 12,
              height: 44,
              background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
              border: 'none',
            }}
          >
            前往解析结果
          </Button>
        </Card>
      </div>
    )
  }

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
              成本预估结果
            </Title>
            <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 15 }}>
              查看详细的成本预估结果，支持多维度分析和导出报告
            </Text>
          </div>
        </div>
      </div>

      {/* 核心指标卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <StatCard
            title="总人天"
            value={result.totalManDay}
            suffix="天"
            precision={1}
            icon={<TeamOutlined />}
            color="#3B82F6"
            gradient="linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%)"
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="总成本"
            value={result.totalCost}
            suffix="万元"
            precision={2}
            icon={<RiseOutlined />}
            color="#EF4444"
            gradient="linear-gradient(135deg, #EF4444 0%, #F87171 100%)"
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="功能模块"
            value={result.moduleCount}
            suffix="个"
            icon={<DashboardOutlined />}
            color="#10B981"
            gradient="linear-gradient(135deg, #10B981 0%, #34D399 100%)"
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="人月"
            value={result.manMonth}
            suffix="月"
            precision={1}
            icon={<ThunderboltOutlined />}
            color="#F59E0B"
            gradient="linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)"
          />
        </Col>
      </Row>

      {/* Tab切换 */}
      <Card
        style={{
          borderRadius: 20,
          border: '1px solid #f1f5f9',
        }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'overview',
              label: '总览视图',
              icon: <DashboardOutlined />,
              children: (
                <div>
                  {/* 图表区域 */}
                  <Row gutter={[24, 24]}>
                    <Col xs={24} lg={12}>
                      <Card
                        title={
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <TeamOutlined style={{ color: '#3B82F6' }} />
                            <Text strong>团队工作量分布</Text>
                          </div>
                        }
                        style={{ borderRadius: 16, border: '1px solid #f1f5f9' }}
                      >
                        <Pie {...teamPieConfig} />
                      </Card>
                    </Col>
                    <Col xs={24} lg={12}>
                      <Card
                        title={
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <BarChartOutlined style={{ color: '#8B5CF6' }} />
                            <Text strong>各阶段工作量</Text>
                          </div>
                        }
                        style={{ borderRadius: 16, border: '1px solid #f1f5f9' }}
                      >
                        <Column {...stageColumnConfig} />
                      </Card>
                    </Col>
                  </Row>
                </div>
              ),
            },
            {
              key: 'detail',
              label: '详细分析',
              icon: <FileTextOutlined />,
              children: (
                <div>
                  {/* 阶段详细分解表 */}
                  <Card
                    title={
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <RocketOutlined style={{ color: '#3B82F6' }} />
                        <Text strong>阶段详细分解</Text>
                      </div>
                    }
                    style={{ borderRadius: 16, marginBottom: 24, border: '1px solid #f1f5f9' }}
                  >
                    <Table
                      columns={stageColumns}
                      dataSource={result.stageBreakdown}
                      rowKey="stage"
                      pagination={false}
                      summary={() => (
                        <Table.Summary fixed>
                          <Table.Summary.Row>
                            <Table.Summary.Cell index={0}>
                              <Text strong>合计</Text>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={1}>
                              <Text strong style={{ color: '#3B82F6' }}>
                                {result.totalManDay.toFixed(1)}
                              </Text>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={2}>
                              <Text strong style={{ color: '#EF4444' }}>
                                {result.totalCost.toFixed(2)}
                              </Text>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={3}>
                              <Text strong>100%</Text>
                            </Table.Summary.Cell>
                          </Table.Summary.Row>
                        </Table.Summary>
                      )}
                    />
                  </Card>

                  {/* 功能模块详细分析表 */}
                  <Card
                    title={
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ThunderboltOutlined style={{ color: '#8B5CF6' }} />
                        <Text strong>功能模块详细分析</Text>
                      </div>
                    }
                    style={{ borderRadius: 16, border: '1px solid #f1f5f9' }}
                  >
                    <Table
                      columns={moduleColumns}
                      dataSource={result.calculationTrace}
                      rowKey="functionName"
                      pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        showTotal: (total) => `共 ${total} 条`,
                      }}
                    />
                  </Card>
                </div>
              ),
            },
            {
              key: 'compliance',
              label: '合规校验',
              icon: <CheckCircleOutlined />,
              children: (
                <div>
                  {/* 占比合规校验结果 */}
                  <Card
                    title={
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CheckCircleOutlined style={{ color: '#10B981' }} />
                        <Text strong>占比合规校验结果</Text>
                      </div>
                    }
                    style={{ borderRadius: 16, marginBottom: 24, border: '1px solid #f1f5f9' }}
                  >
                    <Row gutter={[16, 16]}>
                      {complianceChecks.map((check) => (
                        <Col xs={24} sm={12} md={8} key={check.stage}>
                          <Card
                            size="small"
                            style={{
                              borderRadius: 12,
                              border: check.isCompliant ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                              background: check.isCompliant
                                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(52, 211, 153, 0.1) 100%)'
                                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(248, 113, 113, 0.1) 100%)',
                            }}
                          >
                            <div style={{ marginBottom: 12 }}>
                              <Text strong style={{ fontSize: 14 }}>{check.stage}</Text>
                            </div>
                            <div style={{ marginBottom: 8 }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>实际占比</Text>
                              <br />
                              <Text strong style={{ color: '#0f172a' }}>
                                {(check.actualRatio * 100).toFixed(1)}%
                              </Text>
                            </div>
                            <div style={{ marginBottom: 8 }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>预期范围</Text>
                              <br />
                              <Text style={{ color: '#64748b' }}>
                                {(check.expectedMin * 100).toFixed(1)}% - {(check.expectedMax * 100).toFixed(1)}%
                              </Text>
                            </div>
                            <div>
                              {check.isCompliant ? (
                                <Tag
                                  icon={<CheckCircleOutlined />}
                                  style={{
                                    borderRadius: 8,
                                    background: '#10B981',
                                    color: '#fff',
                                    border: 'none',
                                  }}
                                >
                                  合规
                                </Tag>
                              ) : (
                                <Tag
                                  icon={<ExclamationCircleOutlined />}
                                  style={{
                                    borderRadius: 8,
                                    background: '#EF4444',
                                    color: '#fff',
                                    border: 'none',
                                  }}
                                >
                                  不合规
                                </Tag>
                              )}
                            </div>
                          </Card>
                        </Col>
                      ))}
                    </Row>

                    {/* 合规汇总 */}
                    <Card
                      style={{
                        marginTop: 16,
                        borderRadius: 12,
                        background: complianceChecks.every((c) => c.isCompliant)
                          ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(52, 211, 153, 0.1) 100%)'
                          : 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(251, 191, 36, 0.1) 100%)',
                        border: complianceChecks.every((c) => c.isCompliant)
                          ? '1px solid rgba(16, 185, 129, 0.3)'
                          : '1px solid rgba(245, 158, 11, 0.3)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {complianceChecks.every((c) => c.isCompliant) ? (
                          <CheckCircleOutlined style={{ color: '#10B981', fontSize: 20 }} />
                        ) : (
                          <ExclamationCircleOutlined style={{ color: '#F59E0B', fontSize: 20 }} />
                        )}
                        <Text style={{ color: '#0f172a' }}>
                          {complianceChecks.every((c) => c.isCompliant)
                            ? '所有阶段占比均符合预期范围，成本分配合理'
                            : `存在 ${complianceChecks.filter((c) => !c.isCompliant).length} 个阶段占比不合规，请检查计算参数`}
                        </Text>
                      </div>
                    </Card>
                  </Card>

                  {/* 计算轨迹展示 */}
                  <Card
                    title={
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FileTextOutlined style={{ color: '#64748b' }} />
                        <Text strong>计算轨迹</Text>
                      </div>
                    }
                    style={{ borderRadius: 16, border: '1px solid #f1f5f9' }}
                  >
                    <Table
                      columns={traceColumns}
                      dataSource={result.calculationTrace}
                      rowKey="functionName"
                      pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        showTotal: (total) => `共 ${total} 条计算记录`,
                      }}
                    />
                  </Card>
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* 操作按钮 */}
      <Card
        style={{
          borderRadius: 16,
          marginTop: 24,
          border: '1px solid #f1f5f9',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            size="large"
            onClick={() => navigate(`/cost-estimate/parse-result?projectId=${projectId}`)}
            style={{ borderRadius: 12, height: 44 }}
          >
            <ArrowLeftOutlined style={{ marginRight: 8 }} />
            上一步：解析结果
          </Button>
          <Space>
            <Tooltip title="重新计算成本预估">
              <Button
                size="large"
                icon={<ReloadOutlined />}
                onClick={handleRecalculate}
                loading={recalculating}
                style={{ borderRadius: 12, height: 44 }}
              >
                重新计算
              </Button>
            </Tooltip>
            <Button
              type="primary"
              size="large"
              icon={<DownloadOutlined />}
              onClick={handleExportExcel}
              loading={exporting}
              style={{
                borderRadius: 12,
                height: 44,
                background: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
                border: 'none',
                fontWeight: 600,
              }}
            >
              导出Excel报告
            </Button>
          </Space>
        </div>
      </Card>
    </div>
  )
}