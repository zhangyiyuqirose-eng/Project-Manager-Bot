import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Card,
  Steps,
  Form,
  InputNumber,
  Input,
  Button,
  Typography,
  message,
  Spin,
  Row,
  Col,
  Table,
  Tag,
  Tooltip,
  Empty,
  Modal,
  Statistic,
} from 'antd'
import {
  FileTextOutlined,
  SettingOutlined,
  FileSearchOutlined,
  BarChartOutlined,
  SaveOutlined,
  CalculatorOutlined,
  InfoCircleOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  ThunderboltOutlined,
  RocketOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { estimateApi, projectApi } from '@/api'
import type {
  EstimateConfig,
  ComplexityLevel,
  SystemCoefficient,
  ProcessCoefficient,
  TechStackCoefficient,
  UnitPrice,
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
  estimateResults: Array<{ totalManDay: number; totalCost: number }>
  estimateConfigs: Array<{ id: number }>
}

export default function CostEstimateConfig() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('projectId')

  const [currentStep] = useState(2)  // 步骤3：参数配置
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // 项目列表状态
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [totalProjects, setTotalProjects] = useState(0)

  // 配置数据
  const [complexityConfig, setComplexityConfig] = useState<ComplexityLevel[]>([])
  const [systemCoefficientConfig, setSystemCoefficientConfig] = useState<SystemCoefficient[]>([])
  const [processCoefficientConfig, setProcessCoefficientConfig] = useState<ProcessCoefficient[]>([])
  const [techStackCoefficientConfig, setTechStackCoefficientConfig] = useState<TechStackCoefficient[]>([])
  const [unitPriceConfig, setUnitPriceConfig] = useState<UnitPrice[]>([])
  const [managementCoefficient, setManagementCoefficient] = useState<number>(0.15)

  // 弹窗状态
  const [modalVisible, setModalVisible] = useState(false)
  const [modalType, setModalType] = useState<'complexity' | 'system' | 'process' | 'techStack' | 'unitPrice'>('complexity')
  const [form] = Form.useForm()

  // 加载项目列表（当没有projectId时）
  useEffect(() => {
    if (!projectId) {
      loadProjects()
    }
  }, [projectId])

  // 加载配置参数（当有projectId时）
  useEffect(() => {
    if (projectId) {
      loadConfig()
    }
  }, [projectId])

  // 加载项目列表
  const loadProjects = async () => {
    setProjectsLoading(true)
    try {
      const response = await projectApi.getList({ pageSize: 100 })
      if (response.data.code === 0 || response.data.code === 200) {
        const projectData = response.data.data || []
        // 过滤出有解析结果的项目（可以配置参数）
        const projectsWithDocs = projectData.filter((p: any) => p.documentCount > 0)
        setProjects(projectsWithDocs)
        setTotalProjects(projectsWithDocs.length)
      }
    } catch {
      message.error('加载项目列表失败')
    } finally {
      setProjectsLoading(false)
    }
  }

  // 加载配置
  const loadConfig = async () => {
    setLoading(true)
    try {
      // 先加载默认配置作为基础
      const defaultResponse = await estimateApi.getDefaultConfig()
      if (defaultResponse.data.code === 0 || defaultResponse.data.code === 200) {
        const defaultConfig: EstimateConfig = defaultResponse.data.data
        if (defaultConfig) {
          setComplexityConfig(Array.isArray(defaultConfig.complexityConfig) ? defaultConfig.complexityConfig : [])
          setSystemCoefficientConfig(Array.isArray(defaultConfig.systemCoefficientConfig) ? defaultConfig.systemCoefficientConfig : [])
          setProcessCoefficientConfig(Array.isArray(defaultConfig.processCoefficientConfig) ? defaultConfig.processCoefficientConfig : [])
          setTechStackCoefficientConfig(Array.isArray(defaultConfig.techStackCoefficientConfig) ? defaultConfig.techStackCoefficientConfig : [])
          setUnitPriceConfig(Array.isArray(defaultConfig.unitPriceConfig) ? defaultConfig.unitPriceConfig : [])
          setManagementCoefficient(defaultConfig.managementCoefficient || 0.15)
        }
      }

      // 然后尝试获取已保存的配置来覆盖默认值
      try {
        const response = await estimateApi.getConfig(Number(projectId))
        if (response.data.code === 0 || response.data.code === 200) {
          const savedConfig: EstimateConfig = response.data.data
          if (savedConfig) {
            if (Array.isArray(savedConfig.complexityConfig) && savedConfig.complexityConfig.length > 0) {
              setComplexityConfig(savedConfig.complexityConfig)
            }
            if (Array.isArray(savedConfig.systemCoefficientConfig) && savedConfig.systemCoefficientConfig.length > 0) {
              setSystemCoefficientConfig(savedConfig.systemCoefficientConfig)
            }
            if (Array.isArray(savedConfig.processCoefficientConfig) && savedConfig.processCoefficientConfig.length > 0) {
              setProcessCoefficientConfig(savedConfig.processCoefficientConfig)
            }
            if (Array.isArray(savedConfig.techStackCoefficientConfig) && savedConfig.techStackCoefficientConfig.length > 0) {
              setTechStackCoefficientConfig(savedConfig.techStackCoefficientConfig)
            }
            if (Array.isArray(savedConfig.unitPriceConfig) && savedConfig.unitPriceConfig.length > 0) {
              setUnitPriceConfig(savedConfig.unitPriceConfig)
            }
            if (savedConfig.managementCoefficient) {
              setManagementCoefficient(savedConfig.managementCoefficient)
            }
          }
        }
      } catch {
        // 没有保存的配置，使用默认配置即可
      }
    } catch {
      message.error('加载默认配置失败')
    } finally {
      setLoading(false)
    }
  }

  // 打开新增弹窗
  const openAddModal = (type: 'complexity' | 'system' | 'process' | 'techStack' | 'unitPrice') => {
    setModalType(type)
    form.resetFields()
    setModalVisible(true)
  }

  // 处理新增
  const handleAdd = async () => {
    try {
      const values = await form.validateFields()

      switch (modalType) {
        case 'complexity':
          if (complexityConfig.some(c => c.level === values.level)) {
            message.warning('该复杂度等级已存在')
            return
          }
          setComplexityConfig([...complexityConfig, { level: values.level, workdays: values.workdays || 1 }])
          break
        case 'system':
          if (systemCoefficientConfig.some(s => s.systemCount === values.systemCount)) {
            message.warning('该关联系统数已存在')
            return
          }
          setSystemCoefficientConfig([...systemCoefficientConfig, { systemCount: values.systemCount, coefficient: values.coefficient || 1 }])
          break
        case 'process':
          if (processCoefficientConfig.some(p => p.stage === values.stage)) {
            message.warning('该阶段已存在')
            return
          }
          setProcessCoefficientConfig([...processCoefficientConfig, { stage: values.stage, coefficient: values.coefficient || 0.1 }])
          break
        case 'techStack':
          if (techStackCoefficientConfig.some(t => t.techType === values.techType)) {
            message.warning('该技术类型已存在')
            return
          }
          setTechStackCoefficientConfig([...techStackCoefficientConfig, { techType: values.techType, coefficient: values.coefficient || 1 }])
          break
        case 'unitPrice':
          if (unitPriceConfig.some(u => u.role === values.role)) {
            message.warning('该角色已存在')
            return
          }
          setUnitPriceConfig([...unitPriceConfig, { role: values.role, price: values.price || 1000 }])
          break
      }

      setModalVisible(false)
      message.success('添加成功')
    } catch {
      // 验证失败
    }
  }

  // 处理删除
  const handleDelete = (type: string, key: string | number) => {
    switch (type) {
      case 'complexity':
        setComplexityConfig(complexityConfig.filter(c => c.level !== key))
        break
      case 'system':
        setSystemCoefficientConfig(systemCoefficientConfig.filter(s => s.systemCount !== key))
        break
      case 'process':
        setProcessCoefficientConfig(processCoefficientConfig.filter(p => p.stage !== key))
        break
      case 'techStack':
        setTechStackCoefficientConfig(techStackCoefficientConfig.filter(t => t.techType !== key))
        break
      case 'unitPrice':
        setUnitPriceConfig(unitPriceConfig.filter(u => u.role !== key))
        break
    }
    message.success('删除成功')
  }

  // 保存参数模板
  const handleSaveConfig = async () => {
    if (!projectId) {
      message.warning('缺少项目ID，无法保存配置')
      return
    }

    setSaving(true)
    try {
      const config: EstimateConfig = {
        complexityConfig,
        systemCoefficientConfig,
        processCoefficientConfig,
        techStackCoefficientConfig,
        unitPriceConfig,
        managementCoefficient,
      }

      const response = await estimateApi.saveConfig(Number(projectId), config)
      if (response.data.code === 0 || response.data.code === 200) {
        message.success('配置保存成功')
      }
    } catch {
      message.error('配置保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 保存配置并计算跳转到结果页
  const handleNext = async () => {
    if (!projectId) {
      message.warning('缺少项目ID，无法保存配置')
      return
    }

    setSaving(true)
    try {
      const config: EstimateConfig = {
        complexityConfig,
        systemCoefficientConfig,
        processCoefficientConfig,
        techStackCoefficientConfig,
        unitPriceConfig,
        managementCoefficient,
      }

      // 保存配置
      await estimateApi.saveConfig(Number(projectId), config)

      // 开始计算
      const calcResponse = await estimateApi.calculate(Number(projectId))
      if (calcResponse.data.code === 0 || calcResponse.data.code === 200) {
        message.success('配置保存并计算完成')
        navigate(`/cost-estimate/result?projectId=${projectId}`)
      }
    } catch {
      message.error('操作失败，请重试')
    } finally {
      setSaving(false)
    }
  }

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
      title: '配置状态',
      key: 'configStatus',
      width: 100,
      render: (_: any, record: ProjectListItem) => {
        const hasConfig = record.estimateConfigs && record.estimateConfigs.length > 0
        return (
          <Tag style={{
            borderRadius: 8,
            background: hasConfig ? '#10B98115' : '#94a3b815',
            color: hasConfig ? '#10B981' : '#94a3b8',
            border: 'none'
          }}>
            {hasConfig ? '已配置' : '待配置'}
          </Tag>
        )
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
          icon={<EditOutlined />}
          onClick={() => navigate(`/cost-estimate/config?projectId=${record.id}`)}
          style={{ borderRadius: 8 }}
        >
          配置参数
        </Button>
      )
    }
  ]

  // 复杂度基准表格列配置
  const complexityColumns: ColumnsType<ComplexityLevel> = [
    {
      title: '复杂度等级',
      dataIndex: 'level',
      key: 'level',
      width: 120,
      render: (value: string) => {
        const colors: Record<string, string> = {
          '简单': '#10B981',
          '一般': '#3B82F6',
          '中等': '#F59E0B',
          '复杂': '#EF4444',
          '极复杂': '#8B5CF6',
        }
        return (
          <Tag
            style={{
              borderRadius: 8,
              padding: '4px 12px',
              background: `${colors[value] || '#64748b'}15`,
              color: colors[value] || '#64748b',
              border: 'none',
              fontWeight: 500,
            }}
          >
            {value}
          </Tag>
        )
      },
    },
    {
      title: '基准人天',
      dataIndex: 'workdays',
      key: 'workdays',
      width: 120,
      render: (value: number, _: ComplexityLevel, index: number) => (
        <InputNumber
          min={1}
          max={30}
          value={value}
          onChange={(val) => {
            const newConfig = [...complexityConfig]
            newConfig[index].workdays = val || 1
            setComplexityConfig(newConfig)
          }}
          style={{ width: '100%', borderRadius: 8 }}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 60,
      render: (_, record) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDelete('complexity', record.level)}
        />
      ),
    },
  ]

  // 系统关联度系数表格列配置
  const systemCoefficientColumns: ColumnsType<SystemCoefficient> = [
    {
      title: '关联系统数',
      dataIndex: 'systemCount',
      key: 'systemCount',
      width: 120,
      render: (value: number) => (
        <Text strong style={{ color: '#3B82F6' }}>{value} 个</Text>
      ),
    },
    {
      title: '系数',
      dataIndex: 'coefficient',
      key: 'coefficient',
      width: 120,
      render: (value: number, _: SystemCoefficient, index: number) => (
        <InputNumber
          min={1}
          max={3}
          step={0.1}
          precision={2}
          value={value}
          onChange={(val) => {
            const newConfig = [...systemCoefficientConfig]
            newConfig[index].coefficient = val || 1
            setSystemCoefficientConfig(newConfig)
          }}
          style={{ width: '100%', borderRadius: 8 }}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 60,
      render: (_, record) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDelete('system', record.systemCount)}
        />
      ),
    },
  ]

  // 流程系数表格列配置
  const processCoefficientColumns: ColumnsType<ProcessCoefficient> = [
    {
      title: '阶段',
      dataIndex: 'stage',
      key: 'stage',
      width: 120,
      render: (value: string) => <Text>{value}</Text>,
    },
    {
      title: '系数',
      dataIndex: 'coefficient',
      key: 'coefficient',
      width: 120,
      render: (value: number, _: ProcessCoefficient, index: number) => (
        <InputNumber
          min={0}
          max={1}
          step={0.01}
          precision={2}
          value={value}
          onChange={(val) => {
            const newConfig = [...processCoefficientConfig]
            newConfig[index].coefficient = val || 0.1
            setProcessCoefficientConfig(newConfig)
          }}
          style={{ width: '100%', borderRadius: 8 }}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 60,
      render: (_, record) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDelete('process', record.stage)}
        />
      ),
    },
  ]

  // 技术栈难度系数表格列配置
  const techStackCoefficientColumns: ColumnsType<TechStackCoefficient> = [
    {
      title: '技术类型',
      dataIndex: 'techType',
      key: 'techType',
      width: 120,
      render: (value: string) => <Text>{value}</Text>,
    },
    {
      title: '系数',
      dataIndex: 'coefficient',
      key: 'coefficient',
      width: 120,
      render: (value: number, _: TechStackCoefficient, index: number) => (
        <InputNumber
          min={1}
          max={2}
          step={0.1}
          precision={2}
          value={value}
          onChange={(val) => {
            const newConfig = [...techStackCoefficientConfig]
            newConfig[index].coefficient = val || 1
            setTechStackCoefficientConfig(newConfig)
          }}
          style={{ width: '100%', borderRadius: 8 }}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 60,
      render: (_, record) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDelete('techStack', record.techType)}
        />
      ),
    },
  ]

  // 人天单价表格列配置
  const unitPriceColumns: ColumnsType<UnitPrice> = [
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (value: string) => <Text>{value}</Text>,
    },
    {
      title: '单价(元/天)',
      dataIndex: 'price',
      key: 'price',
      width: 120,
      render: (value: number, _: UnitPrice, index: number) => (
        <InputNumber
          min={500}
          max={5000}
          step={100}
          value={value}
          onChange={(val) => {
            const newConfig = [...unitPriceConfig]
            newConfig[index].price = val || 1000
            setUnitPriceConfig(newConfig)
          }}
          style={{ width: '100%', borderRadius: 8 }}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 60,
      render: (_, record) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDelete('unitPrice', record.role)}
        />
      ),
    },
  ]

  // 弹窗标题映射
  const modalTitles: Record<string, string> = {
    complexity: '新增复杂度等级',
    system: '新增系统关联度',
    process: '新增流程阶段',
    techStack: '新增技术类型',
    unitPrice: '新增角色单价',
  }

  // 弹窗表单字段映射
  const renderModalForm = () => {
    switch (modalType) {
      case 'complexity':
        return (
          <>
            <Form.Item name="level" label="复杂度等级" rules={[{ required: true, message: '请输入复杂度等级' }]}>
              <Input placeholder="如：简单、一般、中等、复杂、极复杂" />
            </Form.Item>
            <Form.Item name="workdays" label="基准人天" rules={[{ required: true, message: '请输入基准人天' }]}>
              <InputNumber min={1} max={30} style={{ width: '100%' }} placeholder="1-30" />
            </Form.Item>
          </>
        )
      case 'system':
        return (
          <>
            <Form.Item name="systemCount" label="关联系统数" rules={[{ required: true, message: '请输入关联系统数' }]}>
              <InputNumber min={1} max={10} style={{ width: '100%' }} placeholder="1-10" />
            </Form.Item>
            <Form.Item name="coefficient" label="系数" rules={[{ required: true, message: '请输入系数' }]}>
              <InputNumber min={1} max={3} step={0.1} precision={2} style={{ width: '100%' }} placeholder="1.0-3.0" />
            </Form.Item>
          </>
        )
      case 'process':
        return (
          <>
            <Form.Item name="stage" label="阶段名称" rules={[{ required: true, message: '请输入阶段名称' }]}>
              <Input placeholder="如：需求分析、系统设计" />
            </Form.Item>
            <Form.Item name="coefficient" label="系数" rules={[{ required: true, message: '请输入系数' }]}>
              <InputNumber min={0} max={1} step={0.01} precision={2} style={{ width: '100%' }} placeholder="0-1" />
            </Form.Item>
          </>
        )
      case 'techStack':
        return (
          <>
            <Form.Item name="techType" label="技术类型" rules={[{ required: true, message: '请输入技术类型' }]}>
              <Input placeholder="如：常规技术、新技术应用" />
            </Form.Item>
            <Form.Item name="coefficient" label="系数" rules={[{ required: true, message: '请输入系数' }]}>
              <InputNumber min={1} max={2} step={0.1} precision={2} style={{ width: '100%' }} placeholder="1.0-2.0" />
            </Form.Item>
          </>
        )
      case 'unitPrice':
        return (
          <>
            <Form.Item name="role" label="角色名称" rules={[{ required: true, message: '请输入角色名称' }]}>
              <Input placeholder="如：项目经理、高级开发" />
            </Form.Item>
            <Form.Item name="price" label="人天单价(元)" rules={[{ required: true, message: '请输入人天单价' }]}>
              <InputNumber min={500} max={5000} step={100} style={{ width: '100%' }} placeholder="500-5000" />
            </Form.Item>
          </>
        )
      default:
        return null
    }
  }

  // 配置卡片标题组件
  const ConfigCardHeader = ({ title, subtitle, icon, color, onAdd }: {
    title: string
    subtitle: string
    icon: React.ReactNode
    color: string
    onAdd?: () => void
  }) => (
    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: `${color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ color, fontSize: 18 }}>{icon}</span>
        </div>
        <div>
          <Text strong style={{ fontSize: 15, color: '#0f172a' }}>{title}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{subtitle}</Text>
        </div>
      </div>
      {onAdd && (
        <Button
          type="text"
          icon={<PlusOutlined />}
          onClick={onAdd}
          style={{ color }}
        >
          新增
        </Button>
      )}
    </div>
  )

  // 渲染项目列表页面
  if (!projectId) {
    return (
      <div className="page-container">
        {/* 功能介绍区域 */}
        <div
          style={{
            background: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
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
              <SettingOutlined style={{ fontSize: 32, color: '#fff' }} />
            </div>
            <div>
              <Title level={3} style={{ color: '#fff', margin: 0, marginBottom: 10 }}>
                参数配置
              </Title>
              <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 15 }}>
                选择项目进行参数配置，或开始新的成本预估
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
                title="可配置项目"
                value={totalProjects}
                suffix="个"
                valueStyle={{ color: '#3B82F6' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8}>
            <Card style={{ borderRadius: 16, border: '1px solid var(--color-border-light)' }}>
              <Statistic
                title="已配置"
                value={projects.filter(p => p.estimateConfigs && p.estimateConfigs.length > 0).length}
                suffix="个"
                valueStyle={{ color: '#10B981' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8}>
            <Card style={{ borderRadius: 16, border: '1px solid var(--color-border-light)' }}>
              <Statistic
                title="待配置"
                value={projects.filter(p => !p.estimateConfigs || p.estimateConfigs.length === 0).length}
                suffix="个"
                valueStyle={{ color: '#F59E0B' }}
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
              <SettingOutlined style={{ marginRight: 10, color: '#10B981' }} />
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
            locale={{ emptyText: '暂无可配置的项目，请先上传需求文档' }}
          />
        </Card>
      </div>
    )
  }

  // 渲染配置编辑页面
  if (loading) {
    return (
      <div className="page-container">
        <Card style={{ borderRadius: 16 }}>
          <Spin size="large" tip="加载配置..." />
        </Card>
      </div>
    )
  }

  return (
    <div className="page-container">
      {/* 功能介绍区域 */}
      <div
        style={{
          background: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
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
            <SettingOutlined style={{ fontSize: 32, color: '#fff' }} />
          </div>
          <div>
            <Title level={3} style={{ color: '#fff', margin: 0, marginBottom: 10 }}>
              参数配置
            </Title>
            <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 15 }}>
              根据项目实际情况调整计算参数，获得更精准的成本预估结果
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

      {/* 配置卡片 */}
      <Row gutter={[24, 24]}>
        {/* 复杂度基准配置 */}
        <Col xs={24} lg={12}>
          <Card
            style={{
              borderRadius: 24,
              border: '1px solid var(--color-border-light)',
              height: '100%',
            }}
          >
            <ConfigCardHeader
              title="复杂度基准配置"
              subtitle="各复杂度等级对应基准人天"
              icon={<CalculatorOutlined />}
              color="#3B82F6"
              onAdd={() => openAddModal('complexity')}
            />
            {complexityConfig.length > 0 ? (
              <Table
                columns={complexityColumns}
                dataSource={complexityConfig}
                rowKey="level"
                pagination={false}
                size="small"
              />
            ) : (
              <Empty description="暂无配置，请添加" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>

        {/* 系统关联度系数配置 */}
        <Col xs={24} lg={12}>
          <Card
            style={{
              borderRadius: 24,
              border: '1px solid var(--color-border-light)',
              height: '100%',
            }}
          >
            <ConfigCardHeader
              title="系统关联度系数"
              subtitle="关联系统数量对应系数"
              icon={<ThunderboltOutlined />}
              color="#8B5CF6"
              onAdd={() => openAddModal('system')}
            />
            {systemCoefficientConfig.length > 0 ? (
              <Table
                columns={systemCoefficientColumns}
                dataSource={systemCoefficientConfig}
                rowKey="systemCount"
                pagination={false}
                size="small"
              />
            ) : (
              <Empty description="暂无配置，请添加" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>

        {/* 流程系数配置 */}
        <Col xs={24} lg={12}>
          <Card
            style={{
              borderRadius: 24,
              border: '1px solid var(--color-border-light)',
              height: '100%',
            }}
          >
            <ConfigCardHeader
              title="流程系数配置"
              subtitle="各阶段工作量分配系数"
              icon={<RocketOutlined />}
              color="#10B981"
              onAdd={() => openAddModal('process')}
            />
            {processCoefficientConfig.length > 0 ? (
              <Table
                columns={processCoefficientColumns}
                dataSource={processCoefficientConfig}
                rowKey="stage"
                pagination={false}
                size="small"
              />
            ) : (
              <Empty description="暂无配置，请添加" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>

        {/* 技术栈难度系数配置 */}
        <Col xs={24} lg={12}>
          <Card
            style={{
              borderRadius: 24,
              border: '1px solid var(--color-border-light)',
              height: '100%',
            }}
          >
            <ConfigCardHeader
              title="技术栈难度系数"
              subtitle="不同技术类型难度系数"
              icon={<InfoCircleOutlined />}
              color="#F59E0B"
              onAdd={() => openAddModal('techStack')}
            />
            {techStackCoefficientConfig.length > 0 ? (
              <Table
                columns={techStackCoefficientColumns}
                dataSource={techStackCoefficientConfig}
                rowKey="techType"
                pagination={false}
                size="small"
              />
            ) : (
              <Empty description="暂无配置，请添加" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>

        {/* 人天单价配置 */}
        <Col xs={24} lg={12}>
          <Card
            style={{
              borderRadius: 24,
              border: '1px solid var(--color-border-light)',
              height: '100%',
            }}
          >
            <ConfigCardHeader
              title="人天单价配置"
              subtitle="各角色人天单价(元)"
              icon={<CalculatorOutlined />}
              color="#EF4444"
              onAdd={() => openAddModal('unitPrice')}
            />
            {unitPriceConfig.length > 0 ? (
              <Table
                columns={unitPriceColumns}
                dataSource={unitPriceConfig}
                rowKey="role"
                pagination={false}
                size="small"
              />
            ) : (
              <Empty description="暂无配置，请添加" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>

        {/* 管理系数配置 */}
        <Col xs={24} lg={12}>
          <Card
            style={{
              borderRadius: 24,
              border: '1px solid var(--color-border-light)',
              height: '100%',
            }}
          >
            <ConfigCardHeader
              title="管理系数配置"
              subtitle="项目管理成本系数"
              icon={<SettingOutlined />}
              color="#64748b"
            />
            <div style={{ padding: '20px 0' }}>
              <Form layout="inline">
                <Form.Item label="管理系数" style={{ marginBottom: 0 }}>
                  <InputNumber
                    min={0}
                    max={0.5}
                    step={0.01}
                    precision={2}
                    value={managementCoefficient}
                    onChange={(val) => setManagementCoefficient(val || 0.15)}
                    style={{ width: 150, borderRadius: 10 }}
                  />
                </Form.Item>
                <Tooltip title="管理系数用于计算项目管理成本，建议范围 0.10 - 0.20">
                  <InfoCircleOutlined style={{ color: '#64748b', marginLeft: 10 }} />
                </Tooltip>
              </Form>
              <Text type="secondary" style={{ marginTop: 16, display: 'block', fontSize: 13 }}>
                建议范围: 0.10 - 0.20，当前值: {managementCoefficient.toFixed(2)}
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

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
            onClick={() => navigate('/cost-estimate/config')}
            style={{ borderRadius: 14, height: 48 }}
          >
            <ArrowLeftOutlined style={{ marginRight: 8 }} />
            返回列表
          </Button>
          <div style={{ display: 'flex', gap: 16 }}>
            <Button
              size="large"
              icon={<SaveOutlined />}
              onClick={handleSaveConfig}
              loading={saving}
              style={{ borderRadius: 14, height: 48 }}
            >
              保存配置
            </Button>
            <Button
              type="primary"
              size="large"
              onClick={handleNext}
              loading={saving}
              style={{
                borderRadius: 14,
                height: 48,
                background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
                border: 'none',
                fontWeight: 600,
              }}
            >
              开始计算
              <ArrowRightOutlined style={{ marginLeft: 8 }} />
            </Button>
          </div>
        </div>
      </Card>

      {/* 新增弹窗 */}
      <Modal
        title={modalTitles[modalType]}
        open={modalVisible}
        onOk={handleAdd}
        onCancel={() => setModalVisible(false)}
        okText="确认添加"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          {renderModalForm()}
        </Form>
      </Modal>
    </div>
  )
}