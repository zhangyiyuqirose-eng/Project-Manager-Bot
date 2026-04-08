import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Card,
  Steps,
  Button,
  Typography,
  message,
  Spin,
  Table,
  Tag,
  Progress,
  Empty,
  Row,
  Col,
  Statistic,
  Select,
  InputNumber,
  Space,
} from 'antd'
import {
  FileTextOutlined,
  SettingOutlined,
  FileSearchOutlined,
  BarChartOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CalculatorOutlined,
  ThunderboltOutlined,
  ClusterOutlined,
  RocketOutlined,
  CodeOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { estimateApi } from '@/api'

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

// 功能点数据结构
interface FunctionPoint {
  name: string
  complexity: string
  complexityScore: number
  associationSystems: number
  associationScore: number
  processComplexity: number
  techStackDifficulty: number
}

// 模块数据结构
interface ModuleData {
  name: string
  description: string
  functions: FunctionPoint[]
}

// 解析结果数据结构
interface ParseResultData {
  projectName: string
  systemName: string
  modules: ModuleData[]
  totalModules: number
  totalFunctions: number
}

export default function CostEstimateParseResult() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('projectId')

  const [currentStep] = useState(1)  // 步骤2：文档解析
  const [loading, setLoading] = useState(true)
  const [parsing, setParsing] = useState(false)
  const [parseResult, setParseResult] = useState<ParseResultData | null>(null)
  const [parseProgress, setParseProgress] = useState(0) // 解析进度 0-100

  // 功能点编辑状态
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editingData, setEditingData] = useState<{ complexity?: string; associationSystems?: number }>({})
  const [savingEdit, setSavingEdit] = useState(false)

  // 加载解析结果
  useEffect(() => {
    const loadParseResult = async () => {
      if (!projectId) {
        message.warning('缺少项目ID')
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        // 获取解析结果
        const response = await estimateApi.getParseResult(Number(projectId))
        if (response.data.code === 0 || response.data.code === 200) {
          const parseData = response.data.data?.parseResult
          if (parseData) {
            const modules: ModuleData[] = (parseData.modules || []).map((m: any) => ({
              name: m.name,
              description: m.description || '',
              functions: (m.functions || m.features || []).map((f: any) => {
                const funcName = typeof f === 'string' ? f : f.name
                const complexity = typeof f === 'object' ? f.complexity : 'medium'
                const associationSystems = typeof f === 'object' ? f.association_systems || 1 : 1
                return {
                  name: funcName,
                  complexity: complexity || 'medium',
                  complexityScore: getComplexityScore(complexity || 'medium'),
                  associationSystems: associationSystems,
                  associationScore: getAssociationScore(associationSystems),
                  processComplexity: getProcessComplexity(complexity || 'medium'),
                  techStackDifficulty: getTechStackDifficulty(complexity || 'medium')
                }
              })
            }))

            const totalFunctions = modules.reduce((sum, m) => sum + m.functions.length, 0)

            setParseResult({
              projectName: parseData.projectName || '项目名称',
              systemName: parseData.systemName || '系统名称',
              modules,
              totalModules: modules.length,
              totalFunctions
            })
          }
        }
      } catch (err: any) {
        // 如果没有解析结果，静默处理
        console.log('No parse result yet')
      } finally {
        setLoading(false)
      }
    }

    loadParseResult()
  }, [projectId])

  // 解析文档
  const handleParse = async () => {
    if (!projectId) return

    setParsing(true)
    setParseProgress(0)

    // 模拟进度更新（解析过程中逐步增加）
    const progressInterval = setInterval(() => {
      setParseProgress(prev => {
        if (prev >= 90) return prev // 在90%时等待实际完成
        return prev + Math.random() * 15 // 每次增加随机进度
      })
    }, 500)

    try {
      const response = await estimateApi.parseDocument(Number(projectId))
      if (response.data.code === 0 || response.data.code === 200) {
        // 解析完成，设置进度为100%
        clearInterval(progressInterval)
        setParseProgress(100)
        message.success('文档解析成功')

        // 延迟一下让进度条显示完成状态
        setTimeout(() => {
          // 重新加载数据
          const parseData = response.data.data?.parseResult
          if (parseData) {
            const modules: ModuleData[] = (parseData.modules || []).map((m: any) => ({
              name: m.name,
              description: m.description || '',
              functions: (m.functions || m.features || []).map((f: any) => {
                const funcName = typeof f === 'string' ? f : f.name
                const complexity = typeof f === 'object' ? f.complexity : 'medium'
                const associationSystems = typeof f === 'object' ? f.association_systems || 1 : 1
                return {
                  name: funcName,
                  complexity: complexity || 'medium',
                  complexityScore: getComplexityScore(complexity || 'medium'),
                  associationSystems: associationSystems,
                  associationScore: getAssociationScore(associationSystems),
                  processComplexity: getProcessComplexity(complexity || 'medium'),
                  techStackDifficulty: getTechStackDifficulty(complexity || 'medium')
                }
              })
            }))

            const totalFunctions = modules.reduce((sum, m) => sum + m.functions.length, 0)

            setParseResult({
              projectName: parseData.projectName || '项目名称',
              systemName: parseData.systemName || '系统名称',
              modules,
              totalModules: modules.length,
              totalFunctions
            })
          }
          setParsing(false)
        }, 500)
      }
    } catch (err: any) {
      clearInterval(progressInterval)
      setParseProgress(0)
      const errorMsg = err?.response?.data?.message || '文档解析失败'
      message.error(errorMsg)
      setParsing(false)
    }
  }

  // 复杂度分数映射
  const getComplexityScore = (complexity: string): number => {
    const scores: Record<string, number> = {
      'very_basic': 0.5,
      'basic': 1.0,
      'medium': 1.5,
      'complex': 2.0,
      'very_complex': 2.5
    }
    return scores[complexity?.toLowerCase()] || 1.5
  }

  // 关联度分数映射
  const getAssociationScore = (systems: number): number => {
    if (systems <= 1) return 1.0
    if (systems < 3) return 1.5
    if (systems <= 5) return 2.0
    return 3.0
  }

  // 流程复杂度映射
  const getProcessComplexity = (complexity: string): number => {
    const scores: Record<string, number> = {
      'very_basic': 0.7,
      'basic': 0.8,
      'medium': 1.0,
      'complex': 1.2,
      'very_complex': 1.5
    }
    return scores[complexity?.toLowerCase()] || 1.0
  }

  // 技术栈难度映射
  const getTechStackDifficulty = (complexity: string): number => {
    const scores: Record<string, number> = {
      'very_basic': 1.0,
      'basic': 1.1,
      'medium': 1.3,
      'complex': 1.5,
      'very_complex': 1.8
    }
    return scores[complexity?.toLowerCase()] || 1.3
  }

  // 复杂度标签渲染
  const renderComplexityTag = (complexity: string) => {
    const config: Record<string, { color: string; label: string }> = {
      'very_basic': { color: '#10B981', label: '较为基础' },
      'basic': { color: '#3B82F6', label: '基础' },
      'medium': { color: '#F59E0B', label: '中等' },
      'complex': { color: '#EF4444', label: '复杂' },
      'very_complex': { color: '#8B5CF6', label: '极复杂' }
    }
    const item = config[complexity?.toLowerCase()] || config['medium']
    return (
      <Tag
        style={{
          borderRadius: 8,
          padding: '2px 10px',
          background: `${item.color}15`,
          color: item.color,
          border: 'none',
          fontWeight: 500
        }}
      >
        {item.label}
      </Tag>
    )
  }

  // 分数进度条渲染
  const renderScoreProgress = (score: number, max: number, color: string) => {
    const percent = (score / max) * 100
    return (
      <Progress
        percent={percent}
        size="small"
        strokeColor={color}
        showInfo={false}
        style={{ width: 60 }}
      />
    )
  }

  // 保存功能点编辑
  const handleSaveEdit = async (record: FunctionPoint, _funcIndex: number) => {
    if (!projectId || !parseResult) return

    setSavingEdit(true)
    try {
      const newComplexity = editingData.complexity || record.complexity
      const newAssociationSystems = editingData.associationSystems || record.associationSystems

      // 更新本地状态
      const updatedModules = parseResult.modules.map((module) => ({
        ...module,
        functions: module.functions.map((func) => {
          // 找到对应的功能点（通过名称匹配）
          if (func.name === record.name) {
            return {
              ...func,
              complexity: newComplexity,
              complexityScore: getComplexityScore(newComplexity),
              associationSystems: newAssociationSystems,
              associationScore: getAssociationScore(newAssociationSystems),
              processComplexity: getProcessComplexity(newComplexity),
              techStackDifficulty: getTechStackDifficulty(newComplexity)
            }
          }
          return func
        })
      }))

      // 调用后端API更新
      await estimateApi.updateParseResult(Number(projectId), {
        modules: updatedModules.map(m => ({
          name: m.name,
          description: m.description,
          functions: m.functions.map(f => ({
            name: f.name,
            complexity: f.complexity,
            association_systems: f.associationSystems
          }))
        }))
      })

      setParseResult({ ...parseResult, modules: updatedModules })
      setEditingKey(null)
      setEditingData({})
      message.success('修改已保存')
    } catch {
      message.error('保存失败')
    } finally {
      setSavingEdit(false)
    }
  }

  // 展开表格列配置（功能点明细）
  const functionColumns: ColumnsType<FunctionPoint> = [
    {
      title: '功能点名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (value: string) => (
        <Text style={{ fontWeight: 500, color: '#0f172a' }}>{value}</Text>
      )
    },
    {
      title: '复杂度',
      dataIndex: 'complexity',
      key: 'complexity',
      width: 140,
      render: (value: string, record: FunctionPoint, index: number) => {
        const key = `${record.name}-${index}`
        const isEditing = editingKey === key

        if (isEditing) {
          return (
            <Select
              value={editingData.complexity || value}
              onChange={(val) => setEditingData({ ...editingData, complexity: val })}
              style={{ width: 110 }}
              options={[
                { value: 'very_basic', label: '较为基础' },
                { value: 'basic', label: '基础' },
                { value: 'medium', label: '中等' },
                { value: 'complex', label: '复杂' },
                { value: 'very_complex', label: '极复杂' }
              ]}
            />
          )
        }
        return renderComplexityTag(value)
      }
    },
    {
      title: '复杂度分值',
      dataIndex: 'complexityScore',
      key: 'complexityScore',
      width: 120,
      render: (value: number) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {renderScoreProgress(value, 2.5, '#3B82F6')}
          <Text strong style={{ color: '#3B82F6' }}>{value.toFixed(1)}</Text>
        </div>
      )
    },
    {
      title: '关联系统数',
      dataIndex: 'associationSystems',
      key: 'associationSystems',
      width: 120,
      render: (value: number, record: FunctionPoint, index: number) => {
        const key = `${record.name}-${index}`
        const isEditing = editingKey === key

        if (isEditing) {
          return (
            <InputNumber
              min={1}
              max={10}
              value={editingData.associationSystems || value}
              onChange={(val) => setEditingData({ ...editingData, associationSystems: val || 1 })}
              style={{ width: 80 }}
            />
          )
        }
        return (
          <Tag style={{ borderRadius: 8, background: '#8B5CF615', color: '#8B5CF6', border: 'none' }}>
            {value} 个
          </Tag>
        )
      }
    },
    {
      title: '关联度系数',
      dataIndex: 'associationScore',
      key: 'associationScore',
      width: 120,
      render: (value: number) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {renderScoreProgress(value, 3, '#8B5CF6')}
          <Text strong style={{ color: '#8B5CF6' }}>{value.toFixed(1)}</Text>
        </div>
      )
    },
    {
      title: '流程复杂度',
      dataIndex: 'processComplexity',
      key: 'processComplexity',
      width: 120,
      render: (value: number) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {renderScoreProgress(value, 1.5, '#10B981')}
          <Text strong style={{ color: '#10B981' }}>{value.toFixed(2)}</Text>
        </div>
      )
    },
    {
      title: '技术栈难度',
      dataIndex: 'techStackDifficulty',
      key: 'techStackDifficulty',
      width: 120,
      render: (value: number) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {renderScoreProgress(value, 1.8, '#F59E0B')}
          <Text strong style={{ color: '#F59E0B' }}>{value.toFixed(2)}</Text>
        </div>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: FunctionPoint, index: number) => {
        const key = `${record.name}-${index}`
        const isEditing = editingKey === key

        if (isEditing) {
          return (
            <Space size="small">
              <Button
                size="small"
                type="primary"
                icon={<SaveOutlined />}
                loading={savingEdit}
                onClick={() => handleSaveEdit(record, index)}
                style={{ borderRadius: 6 }}
              />
              <Button
                size="small"
                icon={<CloseOutlined />}
                onClick={() => {
                  setEditingKey(null)
                  setEditingData({})
                }}
                style={{ borderRadius: 6 }}
              />
            </Space>
          )
        }

        return (
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingKey(key)
              setEditingData({
                complexity: record.complexity,
                associationSystems: record.associationSystems
              })
            }}
            style={{ borderRadius: 6 }}
          />
        )
      }
    }
  ]

  // 主表格列配置（模块展开）
  const moduleColumns: ColumnsType<ModuleData> = [
    {
      title: '模块名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (value: string) => (
        <Text strong style={{ color: '#0f172a', fontSize: 14 }}>{value}</Text>
      )
    },
    {
      title: '功能点数量',
      key: 'functionCount',
      width: 100,
      render: (_: any, record: ModuleData) => (
        <Tag style={{ borderRadius: 8, background: '#3B82F615', color: '#3B82F6', border: 'none' }}>
          {record.functions?.length || 0} 个
        </Tag>
      )
    },
    {
      title: '平均复杂度',
      key: 'avgComplexity',
      width: 100,
      render: (_: any, record: ModuleData) => {
        const funcs = record.functions || []
        if (funcs.length === 0) return '-'
        const avg = funcs.reduce((sum, f) => sum + f.complexityScore, 0) / funcs.length
        return (
          <Text strong style={{ color: '#3B82F6' }}>{avg.toFixed(2)}</Text>
        )
      }
    },
    {
      title: '平均关联度',
      key: 'avgAssociation',
      width: 100,
      render: (_: any, record: ModuleData) => {
        const funcs = record.functions || []
        if (funcs.length === 0) return '-'
        const avg = funcs.reduce((sum, f) => sum + f.associationScore, 0) / funcs.length
        return (
          <Text strong style={{ color: '#8B5CF6' }}>{avg.toFixed(2)}</Text>
        )
      }
    },
    {
      title: '平均流程复杂度',
      key: 'avgProcess',
      width: 120,
      render: (_: any, record: ModuleData) => {
        const funcs = record.functions || []
        if (funcs.length === 0) return '-'
        const avg = funcs.reduce((sum, f) => sum + f.processComplexity, 0) / funcs.length
        return (
          <Text strong style={{ color: '#10B981' }}>{avg.toFixed(2)}</Text>
        )
      }
    },
    {
      title: '平均技术栈难度',
      key: 'avgTechStack',
      width: 120,
      render: (_: any, record: ModuleData) => {
        const funcs = record.functions || []
        if (funcs.length === 0) return '-'
        const avg = funcs.reduce((sum, f) => sum + f.techStackDifficulty, 0) / funcs.length
        return (
          <Text strong style={{ color: '#F59E0B' }}>{avg.toFixed(2)}</Text>
        )
      }
    }
  ]

  // 维度说明卡片
  const DimensionCard = ({ title, icon, color, description, range }: {
    title: string
    icon: React.ReactNode
    color: string
    description: string
    range: string
  }) => (
    <Card
      style={{
        borderRadius: 16,
        border: '1px solid #f1f5f9',
        height: '100%'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: `${color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <span style={{ color, fontSize: 20 }}>{icon}</span>
        </div>
        <Title level={5} style={{ margin: 0 }}>{title}</Title>
      </div>
      <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
        {description}
      </Text>
      <Tag style={{ borderRadius: 8, background: `${color}15`, color, border: 'none' }}>
        取值范围: {range}
      </Tag>
    </Card>
  )

  if (loading) {
    return (
      <div className="page-container">
        <Card style={{ borderRadius: 16 }}>
          <Spin size="large" tip="加载解析结果..." />
        </Card>
      </div>
    )
  }

  if (!projectId) {
    return (
      <div className="page-container">
        <Card style={{ borderRadius: 16, marginBottom: 24 }}>
          <Steps current={currentStep} items={stepItems} />
        </Card>
        <Card style={{ borderRadius: 20, textAlign: 'center', padding: 48 }}>
          <Empty description="缺少项目ID，请先上传需求文档">
            <Button type="primary" onClick={() => navigate('/cost-estimate/upload')}>
              前往上传
            </Button>
          </Empty>
        </Card>
      </div>
    )
  }

  return (
    <div className="page-container">
      {/* 功能介绍区域 */}
      <div
        style={{
          background: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)',
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
            <FileSearchOutlined style={{ fontSize: 32, color: '#fff' }} />
          </div>
          <div>
            <Title level={3} style={{ color: '#fff', margin: 0, marginBottom: 10 }}>
              文档解析结果
            </Title>
            <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 15, lineHeight: 1.6 }}>
              查看AI解析的功能模块和功能点，每个功能点包含4个维度的评估结果
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

      {/* 维度说明 - 更大间距 */}
      <Row gutter={[20, 20]} style={{ marginBottom: 32 }}>
        <Col xs={24} sm={12} lg={6}>
          <DimensionCard
            title="复杂度"
            icon={<ThunderboltOutlined />}
            color="#3B82F6"
            description="功能实现难易程度，基于业务规则、技术复杂度综合评估"
            range="0.5 - 2.5"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <DimensionCard
            title="系统关联度"
            icon={<ClusterOutlined />}
            color="#8B5CF6"
            description="需要对接的外部系统数量，影响集成复杂度"
            range="1.0 - 3.0"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <DimensionCard
            title="流程复杂度"
            icon={<RocketOutlined />}
            color="#10B981"
            description="业务流程的复杂程度，影响开发流程工作量"
            range="0.7 - 1.5"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <DimensionCard
            title="技术栈难度"
            icon={<CodeOutlined />}
            color="#F59E0B"
            description="技术实现难度系数，影响技术选型成本"
            range="1.0 - 1.8"
          />
        </Col>
      </Row>

      {/* 统计概览 */}
      {parseResult && parseResult.modules.length > 0 && (
        <Card
          style={{
            borderRadius: 24,
            marginBottom: 32,
            border: '1px solid var(--color-border-light)',
          }}
        >
          <Row gutter={[32, 20]}>
            <Col xs={12} sm={6}>
              <Statistic
                title="项目名称"
                value={parseResult.projectName}
                valueStyle={{ fontSize: 16, color: '#0f172a' }}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title="系统名称"
                value={parseResult.systemName || '未命名'}
                valueStyle={{ fontSize: 16, color: '#0f172a' }}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title="功能模块数"
                value={parseResult.totalModules}
                suffix="个"
                valueStyle={{ color: '#3B82F6' }}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title="功能点总数"
                value={parseResult.totalFunctions}
                suffix="个"
                valueStyle={{ color: '#10B981' }}
              />
            </Col>
          </Row>
        </Card>
      )}

      {/* 解析结果表格 */}
      <Card
        style={{
          borderRadius: 24,
          marginBottom: 32,
          border: '1px solid var(--color-border-light)',
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <Title level={4} style={{ marginBottom: 8, fontWeight: 600 }}>
            <FileSearchOutlined style={{ marginRight: 10, color: '#F59E0B' }} />
            功能模块分析
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>展开模块查看各功能点的详细评估结果</Text>
        </div>

        {/* 解析进度条 */}
        {parsing && (
          <div style={{ marginBottom: 24, padding: 24, background: '#F0FDF4', borderRadius: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text strong style={{ color: '#10B981' }}>
                <SyncOutlined spin style={{ marginRight: 8 }} />
                正在解析文档...
              </Text>
              <Text style={{ color: '#10B981', fontWeight: 500 }}>{Math.round(parseProgress)}%</Text>
            </div>
            <Progress
              percent={parseProgress}
              strokeColor={{
                '0%': '#10B981',
                '100%': '#059669',
              }}
              trailColor="#E5E7EB"
              style={{ marginBottom: 8 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              AI正在分析需求文档，提取功能模块和功能点...
            </Text>
          </div>
        )}

        {/* 解析完成提示 */}
        {parseProgress === 100 && parseResult && parseResult.modules.length > 0 && !parsing && (
          <div style={{ marginBottom: 24, padding: 16, background: '#EFF6FF', borderRadius: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <CheckCircleOutlined style={{ color: '#3B82F6', fontSize: 20 }} />
              <Text strong style={{ color: '#3B82F6' }}>文档解析完成</Text>
            </div>
          </div>
        )}

        {parseResult && parseResult.modules.length > 0 ? (
          <Table
            columns={moduleColumns}
            dataSource={parseResult.modules}
            rowKey="name"
            pagination={false}
            expandable={{
              expandedRowRender: (record) => (
                <div style={{ margin: -8, padding: 20, background: 'var(--color-bg-secondary)' }}>
                  <Table
                    columns={functionColumns}
                    dataSource={record.functions}
                    rowKey="name"
                    pagination={false}
                    size="small"
                  />
                </div>
              ),
              rowExpandable: (record) => record.functions && record.functions.length > 0,
            }}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: 64 }}>
            <Empty
              description="暂无解析结果"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button
                type="primary"
                icon={<CalculatorOutlined />}
                onClick={handleParse}
                loading={parsing}
                disabled={parsing}
                style={{
                  borderRadius: 14,
                  height: 48,
                  background: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)',
                  border: 'none'
                }}
              >
                {parsing ? '正在解析...' : '开始解析文档'}
              </Button>
            </Empty>
          </div>
        )}
      </Card>

      {/* 操作按钮 */}
      <Card
        style={{
          borderRadius: 20,
          border: '1px solid var(--color-border-light)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            size="large"
            onClick={() => navigate('/cost-estimate/upload')}
            style={{ borderRadius: 14, height: 48 }}
          >
            <ArrowLeftOutlined style={{ marginRight: 8 }} />
            上一步：文件上传
          </Button>
          <div style={{ display: 'flex', gap: 16 }}>
            {(!parseResult || parseResult.modules.length === 0) && (
              <Button
                size="large"
                icon={<CalculatorOutlined />}
                onClick={handleParse}
                loading={parsing}
                style={{ borderRadius: 14, height: 48 }}
              >
                {parsing ? '正在解析...' : '解析文档'}
              </Button>
            )}
            <Button
              type="primary"
              size="large"
              disabled={!parseResult || parseResult.modules.length === 0}
              onClick={() => navigate(`/cost-estimate/config?projectId=${projectId}`)}
              style={{
                borderRadius: 14,
                height: 48,
                background: parseResult && parseResult.modules.length > 0
                  ? 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)'
                  : '#e2e8f0',
                border: 'none',
                fontWeight: 600,
              }}
            >
              下一步：参数配置
              <ArrowRightOutlined style={{ marginLeft: 10 }} />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}