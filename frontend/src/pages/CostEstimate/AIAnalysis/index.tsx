import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Card,
  Button,
  Typography,
  message,
  Spin,
  Table,
  Tag,
  Progress,
  Empty,
  Select,
  InputNumber,
  Space,
} from 'antd'
import {
  FileSearchOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { estimateApi } from '@/api'
import PageTitle from '@/components/common/PageTitle'
import EstimateSteps from '@/components/common/EstimateSteps'

const { Text } = Typography

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

export default function CostEstimateAIAnalysis() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('projectId')

  const [currentStep] = useState(2)
  const [loading, setLoading] = useState(true)
  const [parsing, setParsing] = useState(false)
  const [parseResult, setParseResult] = useState<ParseResultData | null>(null)
  const [parseProgress, setParseProgress] = useState(0)

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
      } catch {
        // 静默处理
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

    const progressInterval = setInterval(() => {
      setParseProgress(prev => {
        if (prev >= 90) return prev
        return prev + Math.random() * 15
      })
    }, 500)

    try {
      const response = await estimateApi.parseDocument(Number(projectId))
      if (response.data.code === 0 || response.data.code === 200) {
        clearInterval(progressInterval)
        setParseProgress(100)
        message.success('文档解析成功')

        setTimeout(() => {
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
      message.error(err?.response?.data?.message || '文档解析失败')
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
      'very_basic': { color: '#10B981', label: '基础' },
      'basic': { color: '#3B82F6', label: '基础' },
      'medium': { color: '#F59E0B', label: '中等' },
      'complex': { color: '#EF4444', label: '复杂' },
      'very_complex': { color: '#8B5CF6', label: '极复杂' }
    }
    const item = config[complexity?.toLowerCase()] || config['medium']
    return (
      <Tag style={{ borderRadius: 6, padding: '2px 8px', background: `${item.color}12`, color: item.color, border: 'none', fontSize: 12 }}>
        {item.label}
      </Tag>
    )
  }

  // 分数渲染
  const renderScore = (score: number, color: string) => (
    <Text strong style={{ color, fontSize: 13 }}>{score.toFixed(1)}</Text>
  )

  // 保存功能点编辑
  const handleSaveEdit = async (record: FunctionPoint) => {
    if (!projectId || !parseResult) return

    setSavingEdit(true)
    try {
      const newComplexity = editingData.complexity || record.complexity
      const newAssociationSystems = editingData.associationSystems || record.associationSystems

      const updatedModules = parseResult.modules.map((module) => ({
        ...module,
        functions: module.functions.map((func) => {
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

  // 功能点表格列配置
  const functionColumns: ColumnsType<FunctionPoint> = [
    {
      title: '功能点名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (value: string) => <Text style={{ fontWeight: 500, fontSize: 13 }}>{value}</Text>
    },
    {
      title: '复杂度',
      dataIndex: 'complexity',
      key: 'complexity',
      width: 100,
      render: (value: string, record: FunctionPoint, index: number) => {
        const key = `${record.name}-${index}`
        const isEditing = editingKey === key

        if (isEditing) {
          return (
            <Select
              value={editingData.complexity || value}
              onChange={(val) => setEditingData({ ...editingData, complexity: val })}
              style={{ width: 90 }}
              size="small"
              options={[
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
      width: 80,
      render: (value: number) => renderScore(value, '#3B82F6')
    },
    {
      title: '关联系统',
      dataIndex: 'associationSystems',
      key: 'associationSystems',
      width: 80,
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
              style={{ width: 60 }}
              size="small"
            />
          )
        }
        return <Text style={{ fontSize: 13 }}>{value} 个</Text>
      }
    },
    {
      title: '关联系数',
      dataIndex: 'associationScore',
      key: 'associationScore',
      width: 70,
      render: (value: number) => renderScore(value, '#8B5CF6')
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: any, record: FunctionPoint, index: number) => {
        const key = `${record.name}-${index}`
        const isEditing = editingKey === key

        if (isEditing) {
          return (
            <Space size="small">
              <Button size="small" type="primary" icon={<SaveOutlined />} loading={savingEdit} onClick={() => handleSaveEdit(record)} style={{ borderRadius: 4 }} />
              <Button size="small" icon={<CloseOutlined />} onClick={() => { setEditingKey(null); setEditingData({}) }} style={{ borderRadius: 4 }} />
            </Space>
          )
        }

        return (
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => { setEditingKey(key); setEditingData({ complexity: record.complexity, associationSystems: record.associationSystems }) }}
            style={{ borderRadius: 4 }}
          />
        )
      }
    }
  ]

  // 模块表格列配置
  const moduleColumns: ColumnsType<ModuleData> = [
    {
      title: '模块名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (value: string) => <Text strong style={{ fontSize: 13 }}>{value}</Text>
    },
    {
      title: '功能点数',
      key: 'functionCount',
      width: 80,
      render: (_: any, record: ModuleData) => (
        <Tag style={{ borderRadius: 6, background: '#3B82F612', color: '#3B82F6', border: 'none' }}>
          {record.functions?.length || 0}
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
        return renderScore(avg, '#3B82F6')
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
        return renderScore(avg, '#8B5CF6')
      }
    }
  ]

  if (loading) {
    return (
      <div className="page-container">
        <Card style={{ borderRadius: 12 }}>
          <Spin size="large" tip="加载解析结果..." />
        </Card>
      </div>
    )
  }

  if (!projectId) {
    return (
      <div className="page-container">
        <PageTitle title="AI分析" icon={<FileSearchOutlined />} />
        <EstimateSteps current={currentStep} />
        <Card style={{ borderRadius: 12, textAlign: 'center', padding: 32 }}>
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
      {/* 页面标题 */}
      <PageTitle
        title="AI分析结果"
        description="查看AI解析的功能模块和功能点评估结果"
        icon={<FileSearchOutlined />}
      />

      {/* 步骤条 */}
      <EstimateSteps current={currentStep} />

      {/* 统计概览 */}
      {parseResult && parseResult.modules.length > 0 && (
        <Card style={{ marginBottom: 20, borderRadius: 12 }}>
          <div style={{ display: 'flex', gap: 40, alignItems: 'center' }}>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>项目名称</Text>
              <div><Text strong style={{ fontSize: 14 }}>{parseResult.projectName}</Text></div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>功能模块</Text>
              <div><Text strong style={{ fontSize: 14, color: '#3B82F6' }}>{parseResult.totalModules} 个</Text></div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>功能点总数</Text>
              <div><Text strong style={{ fontSize: 14, color: '#10B981' }}>{parseResult.totalFunctions} 个</Text></div>
            </div>
          </div>
        </Card>
      )}

      {/* 解析进度 */}
      {parsing && (
        <Card style={{ marginBottom: 20, borderRadius: 12 }}>
          <Text strong style={{ color: '#10B981', marginBottom: 12, display: 'block' }}>正在解析文档...</Text>
          <Progress percent={Math.round(parseProgress)} strokeColor="#10B981" />
        </Card>
      )}

      {/* 解析结果表格 */}
      <Card style={{ marginBottom: 20, borderRadius: 12 }}>
        <div style={{ marginBottom: 12 }}>
          <Text strong style={{ fontSize: 15 }}>功能模块分析</Text>
        </div>

        {parseResult && parseResult.modules.length > 0 ? (
          <Table
            columns={moduleColumns}
            dataSource={parseResult.modules}
            rowKey="name"
            pagination={false}
            expandable={{
              expandedRowRender: (record) => (
                <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
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
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Empty description="暂无解析结果">
              <Button
                type="primary"
                onClick={handleParse}
                loading={parsing}
                style={{ borderRadius: 8 }}
              >
                {parsing ? '正在解析...' : '开始解析文档'}
              </Button>
            </Empty>
          </div>
        )}
      </Card>

      {/* 操作按钮 */}
      <Card style={{ borderRadius: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button onClick={() => navigate(`/cost-estimate/project-info?projectId=${projectId}`)} style={{ borderRadius: 8 }}>
            <ArrowLeftOutlined style={{ marginRight: 8 }} />
            上一步
          </Button>
          <div style={{ display: 'flex', gap: 12 }}>
            {(!parseResult || parseResult.modules.length === 0) && (
              <Button onClick={handleParse} loading={parsing} style={{ borderRadius: 8 }}>
                解析文档
              </Button>
            )}
            <Button
              type="primary"
              disabled={!parseResult || parseResult.modules.length === 0}
              onClick={() => navigate(`/cost-estimate/config?projectId=${projectId}`)}
              style={{ borderRadius: 8, fontWeight: 500 }}
            >
              下一步：参数配置
              <ArrowRightOutlined style={{ marginLeft: 8 }} />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}