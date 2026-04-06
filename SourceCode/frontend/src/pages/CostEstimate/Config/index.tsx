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
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { estimateApi } from '@/api'
import type {
  EstimateConfig,
  ComplexityLevel,
  SystemCoefficient,
  ProcessCoefficient,
  TechStackCoefficient,
  UnitPrice,
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

// 默认复杂度基准配置
const defaultComplexityConfig: ComplexityLevel[] = [
  { level: '简单', workdays: 1 },
  { level: '一般', workdays: 3 },
  { level: '中等', workdays: 5 },
  { level: '复杂', workdays: 8 },
  { level: '极复杂', workdays: 15 },
]

// 默认系统关联度系数配置
const defaultSystemCoefficientConfig: SystemCoefficient[] = [
  { systemCount: 1, coefficient: 1.0 },
  { systemCount: 2, coefficient: 1.2 },
  { systemCount: 3, coefficient: 1.4 },
  { systemCount: 4, coefficient: 1.6 },
  { systemCount: 5, coefficient: 1.8 },
]

// 默认流程系数配置
const defaultProcessCoefficientConfig: ProcessCoefficient[] = [
  { stage: '需求分析', coefficient: 0.15 },
  { stage: '系统设计', coefficient: 0.20 },
  { stage: '开发实现', coefficient: 0.35 },
  { stage: '测试验证', coefficient: 0.15 },
  { stage: '部署上线', coefficient: 0.10 },
  { stage: '运维保障', coefficient: 0.05 },
]

// 默认技术栈难度系数配置
const defaultTechStackCoefficientConfig: TechStackCoefficient[] = [
  { techType: '常规技术', coefficient: 1.0 },
  { techType: '新技术应用', coefficient: 1.2 },
  { techType: '技术改造', coefficient: 1.3 },
  { techType: '技术集成', coefficient: 1.4 },
  { techType: '前沿技术', coefficient: 1.5 },
]

// 默认人天单价配置
const defaultUnitPriceConfig: UnitPrice[] = [
  { role: '项目经理', price: 2500 },
  { role: '高级开发', price: 1800 },
  { role: '中级开发', price: 1500 },
  { role: '初级开发', price: 1200 },
  { role: '测试工程师', price: 1000 },
  { role: '运维工程师', price: 1000 },
]

// 配置卡片标题组件
interface ConfigCardHeaderProps {
  title: string
  subtitle: string
  icon: React.ReactNode
  color: string
  onAdd?: () => void
}

function ConfigCardHeader({ title, subtitle, icon, color, onAdd }: ConfigCardHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: `${color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: 24, color }}>{icon}</span>
        </div>
        <div>
          <Title level={5} style={{ margin: 0, fontWeight: 600 }}>{title}</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>{subtitle}</Text>
        </div>
      </div>
      {onAdd && (
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={onAdd}
          style={{ borderRadius: 8 }}
        >
          新增
        </Button>
      )}
    </div>
  )
}

export default function CostEstimateConfig() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('projectId')

  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [saving, setSaving] = useState(false)

  // 配置数据
  const [complexityConfig, setComplexityConfig] = useState<ComplexityLevel[]>(defaultComplexityConfig)
  const [systemCoefficientConfig, setSystemCoefficientConfig] = useState<SystemCoefficient[]>(defaultSystemCoefficientConfig)
  const [processCoefficientConfig, setProcessCoefficientConfig] = useState<ProcessCoefficient[]>(defaultProcessCoefficientConfig)
  const [techStackCoefficientConfig, setTechStackCoefficientConfig] = useState<TechStackCoefficient[]>(defaultTechStackCoefficientConfig)
  const [unitPriceConfig, setUnitPriceConfig] = useState<UnitPrice[]>(defaultUnitPriceConfig)
  const [managementCoefficient, setManagementCoefficient] = useState<number>(0.15)

  // 弹窗状态
  const [modalVisible, setModalVisible] = useState(false)
  const [modalType, setModalType] = useState<'complexity' | 'system' | 'process' | 'techStack' | 'unitPrice'>('complexity')
  const [form] = Form.useForm()

  // 加载默认参数
  useEffect(() => {
    const loadDefaultConfig = async () => {
      setLoading(true)
      try {
        const response = await estimateApi.getDefaultConfig()
        if (response.data.code === 0 || response.data.code === 200) {
          const config: EstimateConfig = response.data.data
          if (config) {
            // 确保数据是数组格式，否则使用默认配置
            setComplexityConfig(Array.isArray(config.complexityConfig) ? config.complexityConfig : defaultComplexityConfig)
            setSystemCoefficientConfig(Array.isArray(config.systemCoefficientConfig) ? config.systemCoefficientConfig : defaultSystemCoefficientConfig)
            setProcessCoefficientConfig(Array.isArray(config.processCoefficientConfig) ? config.processCoefficientConfig : defaultProcessCoefficientConfig)
            setTechStackCoefficientConfig(Array.isArray(config.techStackCoefficientConfig) ? config.techStackCoefficientConfig : defaultTechStackCoefficientConfig)
            setUnitPriceConfig(Array.isArray(config.unitPriceConfig) ? config.unitPriceConfig : defaultUnitPriceConfig)
            setManagementCoefficient(config.managementCoefficient || 0.15)
          }
        }
      } catch {
        // 使用默认配置
        message.info('使用默认配置参数')
      } finally {
        setLoading(false)
      }
    }

    loadDefaultConfig()
  }, [])

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

      message.success('添加成功')
      setModalVisible(false)
    } catch {
      // 表单验证失败
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

  // 保存配置并跳转到解析结果页
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

      await estimateApi.saveConfig(Number(projectId), config)
      message.success('配置保存成功')
      setCurrentStep(2)
      navigate(`/cost-estimate/parse-result?projectId=${projectId}`)
    } catch {
      message.error('配置保存失败')
    } finally {
      setSaving(false)
    }
  }

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
      render: (value: string) => {
        const icons: Record<string, React.ReactNode> = {
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
            <Text>{value}</Text>
          </div>
        )
      },
    },
    {
      title: '系数',
      dataIndex: 'coefficient',
      key: 'coefficient',
      width: 120,
      render: (value: number, _: ProcessCoefficient, index: number) => (
        <InputNumber
          min={0.01}
          max={1}
          step={0.05}
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
      render: (value: string) => {
        const colors: Record<string, string> = {
          '常规技术': '#64748b',
          '新技术应用': '#3B82F6',
          '技术改造': '#F59E0B',
          '技术集成': '#8B5CF6',
          '前沿技术': '#EF4444',
        }
        return (
          <Tag
            style={{
              borderRadius: 8,
              padding: '4px 12px',
              background: `${colors[value] || '#64748b'}15`,
              color: colors[value] || '#64748b',
              border: 'none',
            }}
          >
            {value}
          </Tag>
        )
      },
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
      render: (value: string) => (
        <Text style={{ fontWeight: 500, color: '#0f172a' }}>{value}</Text>
      ),
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
          formatter={(val) => `¥${val}`}
          parser={(val) => Number(val?.replace('¥', '') || 0)}
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

  // 弹窗表单配置
  const modalFormItems = {
    complexity: (
      <>
        <Form.Item name="level" label="复杂度等级" rules={[{ required: true, message: '请输入复杂度等级' }]}>
          <Input placeholder="如：特高级" />
        </Form.Item>
        <Form.Item name="workdays" label="基准人天" rules={[{ required: true, message: '请输入基准人天' }]}>
          <InputNumber min={1} max={30} style={{ width: '100%' }} placeholder="如：20" />
        </Form.Item>
      </>
    ),
    system: (
      <>
        <Form.Item name="systemCount" label="关联系统数" rules={[{ required: true, message: '请输入关联系统数' }]}>
          <InputNumber min={1} max={20} style={{ width: '100%' }} placeholder="如：6" />
        </Form.Item>
        <Form.Item name="coefficient" label="系数" rules={[{ required: true, message: '请输入系数' }]}>
          <InputNumber min={1} max={3} step={0.1} precision={2} style={{ width: '100%' }} placeholder="如：2.0" />
        </Form.Item>
      </>
    ),
    process: (
      <>
        <Form.Item name="stage" label="阶段名称" rules={[{ required: true, message: '请输入阶段名称' }]}>
          <Input placeholder="如：数据迁移" />
        </Form.Item>
        <Form.Item name="coefficient" label="系数" rules={[{ required: true, message: '请输入系数' }]}>
          <InputNumber min={0.01} max={1} step={0.01} precision={2} style={{ width: '100%' }} placeholder="如：0.05" />
        </Form.Item>
      </>
    ),
    techStack: (
      <>
        <Form.Item name="techType" label="技术类型" rules={[{ required: true, message: '请输入技术类型' }]}>
          <Input placeholder="如：AI大模型" />
        </Form.Item>
        <Form.Item name="coefficient" label="系数" rules={[{ required: true, message: '请输入系数' }]}>
          <InputNumber min={1} max={2} step={0.1} precision={2} style={{ width: '100%' }} placeholder="如：1.6" />
        </Form.Item>
      </>
    ),
    unitPrice: (
      <>
        <Form.Item name="role" label="角色名称" rules={[{ required: true, message: '请输入角色名称' }]}>
          <Input placeholder="如：AI训练师" />
        </Form.Item>
        <Form.Item name="price" label="单价(元/天)" rules={[{ required: true, message: '请输入单价' }]}>
          <InputNumber min={500} max={5000} step={100} style={{ width: '100%' }} placeholder="如：2500" />
        </Form.Item>
      </>
    ),
  }

  const modalTitles = {
    complexity: '新增复杂度等级',
    system: '新增系统关联度',
    process: '新增流程阶段',
    techStack: '新增技术类型',
    unitPrice: '新增角色单价',
  }

  if (loading) {
    return (
      <div className="page-container">
        <Card style={{ borderRadius: 16 }}>
          <Spin size="large" description="加载默认配置..." />
        </Card>
      </div>
    )
  }

  if (!projectId) {
    return (
      <div className="page-container">
        <Card style={{ borderRadius: 16 }}>
          <Empty
            description="缺少项目ID，请先上传需求文档"
          >
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
          background: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
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
            <SettingOutlined style={{ fontSize: 32, color: '#fff' }} />
          </div>
          <div>
            <Title level={3} style={{ color: '#fff', margin: 0, marginBottom: 8 }}>
              参数配置
            </Title>
            <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 15 }}>
              根据项目实际情况调整计算参数，获得更精准的成本预估结果
            </Text>
          </div>
        </div>
      </div>

      {/* 配置卡片 */}
      <Row gutter={[24, 24]}>
        {/* 复杂度基准配置 */}
        <Col xs={24} lg={12}>
          <Card
            style={{
              borderRadius: 20,
              border: '1px solid #f1f5f9',
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
            <Table
              columns={complexityColumns}
              dataSource={complexityConfig}
              rowKey="level"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>

        {/* 系统关联度系数配置 */}
        <Col xs={24} lg={12}>
          <Card
            style={{
              borderRadius: 20,
              border: '1px solid #f1f5f9',
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
            <Table
              columns={systemCoefficientColumns}
              dataSource={systemCoefficientConfig}
              rowKey="systemCount"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>

        {/* 流程系数配置 */}
        <Col xs={24} lg={12}>
          <Card
            style={{
              borderRadius: 20,
              border: '1px solid #f1f5f9',
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
            <Table
              columns={processCoefficientColumns}
              dataSource={processCoefficientConfig}
              rowKey="stage"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>

        {/* 技术栈难度系数配置 */}
        <Col xs={24} lg={12}>
          <Card
            style={{
              borderRadius: 20,
              border: '1px solid #f1f5f9',
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
            <Table
              columns={techStackCoefficientColumns}
              dataSource={techStackCoefficientConfig}
              rowKey="techType"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>

        {/* 人天单价配置 */}
        <Col xs={24} lg={12}>
          <Card
            style={{
              borderRadius: 20,
              border: '1px solid #f1f5f9',
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
            <Table
              columns={unitPriceColumns}
              dataSource={unitPriceConfig}
              rowKey="role"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>

        {/* 管理系数配置 */}
        <Col xs={24} lg={12}>
          <Card
            style={{
              borderRadius: 20,
              border: '1px solid #f1f5f9',
              height: '100%',
            }}
          >
            <ConfigCardHeader
              title="管理系数配置"
              subtitle="项目管理成本系数"
              icon={<SettingOutlined />}
              color="#64748b"
            />
            <div style={{ padding: '16px 0' }}>
              <Form layout="inline">
                <Form.Item label="管理系数" style={{ marginBottom: 0 }}>
                  <InputNumber
                    min={0}
                    max={0.5}
                    step={0.01}
                    precision={2}
                    value={managementCoefficient}
                    onChange={(val) => setManagementCoefficient(val || 0.15)}
                    style={{ width: 150, borderRadius: 8 }}
                  />
                </Form.Item>
                <Tooltip title="管理系数用于计算项目管理成本，建议范围 0.10 - 0.20">
                  <InfoCircleOutlined style={{ color: '#64748b', marginLeft: 8 }} />
                </Tooltip>
              </Form>
              <Text type="secondary" style={{ marginTop: 12, display: 'block' }}>
                建议范围: 0.10 - 0.20，当前值: {managementCoefficient.toFixed(2)}
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

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
            onClick={() => navigate('/cost-estimate/upload')}
            style={{ borderRadius: 12, height: 44 }}
          >
            <ArrowLeftOutlined style={{ marginRight: 8 }} />
            上一步：文件上传
          </Button>
          <div style={{ display: 'flex', gap: 12 }}>
            <Button
              size="large"
              icon={<SaveOutlined />}
              onClick={handleSaveConfig}
              loading={saving}
              style={{ borderRadius: 12, height: 44 }}
            >
              保存参数模板
            </Button>
            <Button
              type="primary"
              size="large"
              icon={<ArrowRightOutlined />}
              onClick={handleNext}
              loading={saving}
              style={{
                borderRadius: 12,
                height: 44,
                background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
                border: 'none',
                fontWeight: 600,
              }}
            >
              下一步：查看解析结果
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
          {modalFormItems[modalType]}
        </Form>
      </Modal>
    </div>
  )
}