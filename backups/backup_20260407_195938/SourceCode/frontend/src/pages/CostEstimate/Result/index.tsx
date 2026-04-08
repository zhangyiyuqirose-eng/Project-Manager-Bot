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
  Statistic,
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
  DashboardOutlined,
  ThunderboltOutlined,
  PlusOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { Pie, Column } from '@ant-design/charts'
import { estimateApi, projectApi } from '@/api'
import type {
  EstimateResult,
  StageBreakdown,
  CalculationTrace,
} from '@/types'

const { Title, Text } = Typography

// 步骤条配置（4步）- 调整顺序：上传->解析->配置->结果
const stepItems = [
  {
    title: '文件上传',
    description: '上传需求文档',
    icon: <FileTextOutlined />,
  },
  {
    title: '文档解析',
    description: '查看功能点详情',
    icon: <FileSearchOutlined />,
  },
  {
    title: '参数配置',
    description: '配置计算参数',
    icon: <SettingOutlined />,
  },
  {
    title: '结果展示',
    description: '查看成本预估',
    icon: <BarChartOutlined />,
  },
]

// 项目列表项
interface ProjectListItem {
  id: number
  projectName: string
  projectType: string | null
  contractAmount: number | null
  status: string
  createdAt: string
  members: Array<{ id: number; name: string; level: string; role: string | null }>
  estimateResults: Array<{ id: number; totalManDay: number; totalCost: number }>
  estimateConfigs: Array<{ id: number }>
}

// KPI卡片配置
interface KPICardProps {
  title: string
  value: number
  unit: string
  precision?: number
  bgColor: string
  borderColor: string
}

function KPICard({ title, value, unit, precision = 2, bgColor, borderColor }: KPICardProps) {
  return (
    <div
      style={{
        background: bgColor,
        borderRadius: 12,
        padding: '20px 24px',
        border: `1px solid ${borderColor}`,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
        height: '100%',
      }}
    >
      <div style={{ marginBottom: 8 }}>
        <Text style={{ fontSize: 14, color: '#64748B' }}>{title}</Text>
      </div>
      <div style={{ marginBottom: 4 }}>
        <Text strong style={{ fontSize: 32, color: '#1E293B' }}>
          {precision ? value.toFixed(precision) : value}
        </Text>
      </div>
      <div>
        <Text style={{ fontSize: 13, color: '#64748B' }}>{unit}</Text>
      </div>
    </div>
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

  // 项目列表状态
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [totalProjects, setTotalProjects] = useState(0)

  // 结果数据
  const [result, setResult] = useState<EstimateResult | null>(null)

  // 加载项目列表（当没有projectId时）
  useEffect(() => {
    if (!projectId) {
      loadProjects()
    }
  }, [projectId])

  // 加载项目列表
  const loadProjects = async () => {
    setProjectsLoading(true)
    try {
      const response = await projectApi.getList({ pageSize: 100 })
      if (response.data.code === 0 || response.data.code === 200) {
        const projectData = response.data.data || []
        // 过滤出有预估结果的项目
        const projectsWithResults = projectData.filter((p: any) =>
          p.estimateResults && p.estimateResults.length > 0
        )
        setProjects(projectsWithResults)
        setTotalProjects(projectsWithResults.length)
      }
    } catch {
      message.error('加载项目列表失败')
    } finally {
      setProjectsLoading(false)
    }
  }

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

      // 从响应头获取项目名称
      const projectName = response.headers['x-project-name']
        ? decodeURIComponent(response.headers['x-project-name'])
        : projectId
      link.download = `成本预估报告_${projectName}_${new Date().toISOString().slice(0, 10)}.xlsx`

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      // 检查是否已确认
      const isConfirmed = response.headers['x-project-confirmed'] === 'true'
      if (isConfirmed) {
        message.success('报告导出成功，项目已确认保存到"我的项目"')
      } else {
        message.success('报告导出成功')
      }
    } catch {
      message.error('报告导出失败')
    } finally {
      setExporting(false)
    }
  }

  // 团队工作量饼图配置 - 环形饼图
  const teamPieConfig = {
    appendPadding: [20, 20, 20, 20],
    data: result?.teamBreakdown?.map((item) => ({
      type: item.team,
      value: item.workdays,
    })) || [],
    angleField: 'value',
    colorField: 'type',
    radius: 0.85,
    innerRadius: 0.6,
    // 指定配色
    color: (datum: any) => {
      const colorMap: Record<string, string> = {
        '产品团队': '#3B82F6',
        '产品': '#3B82F6',
        'UI团队': '#A78BFA',
        'UI': '#A78BFA',
        '研发团队': '#34D399',
        '研发': '#34D399',
        '测试团队': '#FB923C',
        '测试': '#FB923C',
        '项目管理': '#F472B6',
        'PM': '#F472B6',
      }
      return colorMap[datum.type] || '#94A3B8'
    },
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
    },
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
        formatter: (_text: string, item: any) => {
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
    ],
    statistic: {
      title: {
        offsetY: -8,
        style: {
          fontSize: '13px',
          color: '#64748B',
          fontWeight: 400,
        },
        customHtml: () => '总工作量',
      },
      content: {
        offsetY: 8,
        style: {
          fontSize: '24px',
          color: '#1E293B',
          fontWeight: 700,
        },
        customHtml: () => `${result?.totalManDay?.toFixed(1) || '0'}<span style="font-size:13px;color:#64748B;font-weight:400"> 人天</span>`,
      },
    },
    state: {
      active: {
        style: (_element: any) => {
          return {
            lineWidth: 2,
            stroke: '#fff',
            shadowBlur: 8,
            shadowColor: 'rgba(0, 0, 0, 0.1)',
          }
        },
      },
    },
  }

  // 各阶段工作量柱状图配置 - 分组柱状图
  const stageColumnConfig = {
    data: result?.stageBreakdown?.map((item) => ({
      stage: item.stage,
      workdays: item.workdays,
      cost: item.cost,
    })) || [],
    xField: 'stage',
    yField: 'workdays',
    // 各阶段配色
    color: (datum: any) => {
      const colorMap: Record<string, string> = {
        '需求': '#3B82F6',
        'UI设计': '#A78BFA',
        '技术设计': '#60A5FA',
        '开发': '#34D399',
        '技术测试': '#FB923C',
        '性能测试': '#94A3B8',
        '投产上线': '#FBBF24',
      }
      return colorMap[datum.stage] || '#3B82F6'
    },
    label: {
      position: 'top' as const,
      style: {
        fill: '#1E293B',
        fontSize: 12,
        fontWeight: 500,
      },
      formatter: (datum: any) => `${datum.workdays.toFixed(1)}`,
    },
    meta: {
      stage: { alias: '阶段' },
      workdays: { alias: '人天' },
    },
    columnStyle: {
      radius: [6, 6, 0, 0],
    },
    yAxis: {
      grid: {
        line: {
          style: {
            stroke: '#E2E8F0',
            lineWidth: 1,
          },
        },
      },
      label: {
        style: {
          fill: '#64748B',
          fontSize: 12,
        },
      },
    },
    xAxis: {
      label: {
        style: {
          fill: '#374151',
          fontSize: 12,
        },
        autoRotate: true,
      },
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
      title: '成本(元)',
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

  // 项目列表表格列配置
  const projectColumns: ColumnsType<ProjectListItem> = [
    {
      title: '项目名称',
      dataIndex: 'projectName',
      key: 'projectName',
      width: 200,
      render: (value: string) => (
        <Text strong style={{ color: '#0f172a' }}>{value}</Text>
      )
    },
    {
      title: '项目类型',
      dataIndex: 'projectType',
      key: 'projectType',
      width: 100,
      render: (value: string) => value ? (
        <Tag style={{ borderRadius: 8, background: '#3B82F615', color: '#3B82F6', border: 'none' }}>
          {value}
        </Tag>
      ) : '-'
    },
    {
      title: '团队成员',
      key: 'members',
      width: 100,
      render: (_: any, record: ProjectListItem) => (
        <Tag style={{ borderRadius: 8, background: '#8B5CF615', color: '#8B5CF6', border: 'none' }}>
          {record.members?.length || 0} 人
        </Tag>
      )
    },
    {
      title: '预估结果',
      key: 'estimateResult',
      width: 150,
      render: (_: any, record: ProjectListItem) => {
        const result = record.estimateResults?.[0]
        if (result) {
          return (
            <div>
              <Text style={{ color: '#10B981', fontWeight: 500 }}>{result.totalManDay.toFixed(1)} 人天</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>¥{result.totalCost.toFixed(0)}</Text>
            </div>
          )
        }
        return <Tag style={{ borderRadius: 8, background: '#F59E0B15', color: '#F59E0B', border: 'none' }}>未计算</Tag>
      }
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (value: string) => new Date(value).toLocaleDateString('zh-CN')
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: ProjectListItem) => (
        <Button
          type="primary"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/cost-estimate/result?projectId=${record.id}`)}
          style={{ borderRadius: 8 }}
        >
          查看结果
        </Button>
      )
    }
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

  // 渲染项目列表页面（当没有projectId时）
  if (!projectId) {
    return (
      <div className="page-container">
        {/* 功能介绍区域 */}
        <div
          style={{
            background: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
            borderRadius: 24,
            padding: '48px 48px',
            marginBottom: 32,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <div
              style={{
                width: 68,
                height: 68,
                borderRadius: 18,
                background: 'rgba(255, 255, 255, 0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BarChartOutlined style={{ fontSize: 32, color: '#fff' }} />
            </div>
            <div>
              <Title level={3} style={{ color: '#fff', margin: 0, marginBottom: 10 }}>
                预估结果
              </Title>
              <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 15 }}>
                查看已完成成本预估的项目结果
              </Text>
            </div>
          </div>
        </div>

        {/* 步骤条 */}
        <Card
          style={{
            borderRadius: 20,
            marginBottom: 32,
            border: '1px solid var(--color-border-light)',
          }}
        >
          <Steps current={currentStep} items={stepItems} />
        </Card>

        {/* 统计概览 */}
        <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={8}>
            <Card style={{ borderRadius: 16, border: '1px solid var(--color-border-light)' }}>
              <Statistic
                title="已预估项目"
                value={totalProjects}
                suffix="个"
                valueStyle={{ color: '#8B5CF6' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8}>
            <Card style={{ borderRadius: 16, border: '1px solid var(--color-border-light)' }}>
              <Statistic
                title="总人天"
                value={projects.reduce((sum, p) => sum + (p.estimateResults?.[0]?.totalManDay || 0), 0)}
                suffix="天"
                precision={1}
                valueStyle={{ color: '#3B82F6' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8}>
            <Card style={{ borderRadius: 16, border: '1px solid var(--color-border-light)' }}>
              <Statistic
                title="总成本"
                value={projects.reduce((sum, p) => sum + (p.estimateResults?.[0]?.totalCost || 0), 0)}
                suffix="元"
                precision={0}
                valueStyle={{ color: '#EF4444' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 项目列表 */}
        <Card
          style={{
            borderRadius: 24,
            border: '1px solid var(--color-border-light)',
          }}
        >
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={4} style={{ margin: 0 }}>
              <BarChartOutlined style={{ marginRight: 10, color: '#8B5CF6' }} />
              项目列表
            </Title>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/cost-estimate/upload')}
              style={{
                borderRadius: 10,
                background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
                border: 'none',
              }}
            >
              新建预估
            </Button>
          </div>

          <Table
            columns={projectColumns}
            dataSource={projects}
            rowKey="id"
            loading={projectsLoading}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            locale={{ emptyText: '暂无预估结果，请先完成成本预估流程' }}
          />
        </Card>
      </div>
    )
  }

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
    <div className="page-container" style={{ background: '#F8FAFC', minHeight: '100vh' }}>
      {/* 功能介绍区域 */}
      <div
        style={{
          background: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
          borderRadius: 24,
          padding: '48px 48px',
          marginBottom: 32,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 28 }}>
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: 18,
              background: 'rgba(255, 255, 255, 0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BarChartOutlined style={{ fontSize: 32, color: '#fff' }} />
          </div>
          <div>
            <Title level={3} style={{ color: '#fff', margin: 0, marginBottom: 10 }}>
              成本预估结果
            </Title>
            <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 15, lineHeight: 1.6 }}>
              查看详细的成本预估结果，支持多维度分析和导出报告
            </Text>
          </div>
        </div>
      </div>

      {/* 步骤条 */}
      <Card
        style={{
          borderRadius: 20,
          marginBottom: 32,
          border: '1px solid var(--color-border-light)',
        }}
      >
        <Steps current={currentStep} items={stepItems} />
      </Card>

      {/* 核心指标卡片 - KPI风格 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <KPICard
            title="总工作量"
            value={result.totalManDay}
            unit="人天"
            precision={2}
            bgColor="#EFF6FF"
            borderColor="#DBEAFE"
          />
        </Col>
        <Col xs={12} sm={6}>
          <KPICard
            title="人月折算"
            value={result.manMonth}
            unit="人月"
            precision={2}
            bgColor="#ECFDF5"
            borderColor="#D1FAE5"
          />
        </Col>
        <Col xs={12} sm={6}>
          <KPICard
            title="预估总成本"
            value={result.totalCost / 10000}
            unit="万元"
            precision={2}
            bgColor="#FFF7ED"
            borderColor="#FFEDD5"
          />
        </Col>
        <Col xs={12} sm={6}>
          <KPICard
            title="功能模块数"
            value={result.moduleCount}
            unit="个模块"
            precision={0}
            bgColor="#FAF5FF"
            borderColor="#F3E8FF"
          />
        </Col>
      </Row>

      {/* Tab切换 */}
      <Card
        style={{
          borderRadius: 12,
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
        }}
        bodyStyle={{ padding: '16px 24px' }}
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
                  {/* 图表区域 - 左右分栏 */}
                  <Row gutter={16}>
                    <Col xs={24} lg={12}>
                      <Card
                        title={
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Text strong style={{ fontSize: 15, color: '#1E293B' }}>团队工作量分布</Text>
                          </div>
                        }
                        style={{
                          borderRadius: 12,
                          border: '1px solid #E2E8F0',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                          height: '100%',
                        }}
                        bodyStyle={{ padding: '16px 20px' }}
                      >
                        <Pie {...teamPieConfig} />
                      </Card>
                    </Col>
                    <Col xs={24} lg={12}>
                      <Card
                        title={
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Text strong style={{ fontSize: 15, color: '#1E293B' }}>各阶段工作量</Text>
                          </div>
                        }
                        style={{
                          borderRadius: 12,
                          border: '1px solid #E2E8F0',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                          height: '100%',
                        }}
                        bodyStyle={{ padding: '16px 20px' }}
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <RocketOutlined style={{ color: '#3B82F6' }} />
                        <Text strong>阶段详细分解</Text>
                      </div>
                    }
                    style={{ borderRadius: 18, marginBottom: 28, border: '1px solid var(--color-border-light)' }}
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <ThunderboltOutlined style={{ color: '#8B5CF6' }} />
                        <Text strong>功能模块详细分析</Text>
                      </div>
                    }
                    style={{ borderRadius: 18, border: '1px solid var(--color-border-light)' }}
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <CheckCircleOutlined style={{ color: '#10B981' }} />
                        <Text strong>占比合规校验结果</Text>
                      </div>
                    }
                    style={{ borderRadius: 18, marginBottom: 28, border: '1px solid var(--color-border-light)' }}
                  >
                    <Row gutter={[20, 20]}>
                      {complianceChecks.map((check) => (
                        <Col xs={24} sm={12} md={8} key={check.stage}>
                          <Card
                            size="small"
                            style={{
                              borderRadius: 14,
                              border: check.isCompliant ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)',
                              background: check.isCompliant
                                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(52, 211, 153, 0.08) 100%)'
                                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(248, 113, 113, 0.08) 100%)',
                            }}
                          >
                            <div style={{ marginBottom: 14 }}>
                              <Text strong style={{ fontSize: 14 }}>{check.stage}</Text>
                            </div>
                            <div style={{ marginBottom: 10 }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>实际占比</Text>
                              <br />
                              <Text strong style={{ color: '#0f172a' }}>
                                {(check.actualRatio * 100).toFixed(1)}%
                              </Text>
                            </div>
                            <div style={{ marginBottom: 10 }}>
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
                                    borderRadius: 10,
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
                                    borderRadius: 10,
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
                        marginTop: 20,
                        borderRadius: 14,
                        background: complianceChecks.every((c) => c.isCompliant)
                          ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(52, 211, 153, 0.08) 100%)'
                          : 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(251, 191, 36, 0.08) 100%)',
                        border: complianceChecks.every((c) => c.isCompliant)
                          ? '1px solid rgba(16, 185, 129, 0.25)'
                          : '1px solid rgba(245, 158, 11, 0.25)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <FileTextOutlined style={{ color: '#64748b' }} />
                        <Text strong>计算轨迹</Text>
                      </div>
                    }
                    style={{ borderRadius: 18, border: '1px solid var(--color-border-light)' }}
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
          borderRadius: 20,
          marginTop: 32,
          border: '1px solid var(--color-border-light)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            size="large"
            onClick={() => navigate('/cost-estimate/result')}
            style={{ borderRadius: 14, height: 48 }}
          >
            <ArrowLeftOutlined style={{ marginRight: 8 }} />
            返回列表
          </Button>
          <Space>
            <Tooltip title="重新计算成本预估">
              <Button
                size="large"
                icon={<ReloadOutlined />}
                onClick={handleRecalculate}
                loading={recalculating}
                style={{ borderRadius: 14, height: 48 }}
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
                borderRadius: 14,
                height: 48,
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