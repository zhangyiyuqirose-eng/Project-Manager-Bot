import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Card,
  Form,
  InputNumber,
  Button,
  Typography,
  message,
  Spin,
  Row,
  Col,
  Table,
  Tooltip,
  Empty,
  Modal,
  Input,
} from 'antd'
import {
  SettingOutlined,
  SaveOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
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
import PageTitle from '@/components/common/PageTitle'
import EstimateSteps from '@/components/common/EstimateSteps'

const { Text } = Typography

export default function CostEstimateConfig() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('projectId')

  const [currentStep] = useState(3)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

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

  // 加载配置参数
  useEffect(() => {
    if (projectId) {
      loadConfig()
    }
  }, [projectId])

  const loadConfig = async () => {
    setLoading(true)
    try {
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
        // 使用默认配置
      }
    } catch {
      message.error('加载默认配置失败')
    } finally {
      setLoading(false)
    }
  }

  const openAddModal = (type: 'complexity' | 'system' | 'process' | 'techStack' | 'unitPrice') => {
    setModalType(type)
    form.resetFields()
    setModalVisible(true)
  }

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

  const handleSaveConfig = async () => {
    if (!projectId) {
      message.warning('缺少项目ID')
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
    } catch {
      message.error('配置保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleNext = async () => {
    if (!projectId) {
      message.warning('缺少项目ID')
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
      const calcResponse = await estimateApi.calculate(Number(projectId))
      if (calcResponse.data.code === 0 || calcResponse.data.code === 200) {
        message.success('计算完成')
        navigate(`/cost-estimate/result?projectId=${projectId}`)
      }
    } catch {
      message.error('操作失败')
    } finally {
      setSaving(false)
    }
  }

  // 复杂度表格列
  const complexityColumns: ColumnsType<ComplexityLevel> = [
    { title: '等级', dataIndex: 'level', key: 'level', width: 100 },
    {
      title: '基准人天', dataIndex: 'workdays', key: 'workdays', width: 100,
      render: (value: number, _: ComplexityLevel, index: number) => (
        <InputNumber min={1} max={30} value={value} onChange={(val) => {
          const newConfig = [...complexityConfig]
          newConfig[index].workdays = val || 1
          setComplexityConfig(newConfig)
        }} style={{ width: 80 }} size="small" />
      ),
    },
    { title: '', key: 'action', width: 40, render: (_, record) => <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete('complexity', record.level)} /> },
  ]

  // 系统系数表格列
  const systemColumns: ColumnsType<SystemCoefficient> = [
    { title: '系统数', dataIndex: 'systemCount', key: 'systemCount', width: 80, render: (v) => `${v} 个` },
    {
      title: '系数', dataIndex: 'coefficient', key: 'coefficient', width: 100,
      render: (value: number, _: SystemCoefficient, index: number) => (
        <InputNumber min={1} max={3} step={0.1} precision={2} value={value} onChange={(val) => {
          const newConfig = [...systemCoefficientConfig]
          newConfig[index].coefficient = val || 1
          setSystemCoefficientConfig(newConfig)
        }} style={{ width: 80 }} size="small" />
      ),
    },
    { title: '', key: 'action', width: 40, render: (_, record) => <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete('system', record.systemCount)} /> },
  ]

  // 流程系数表格列
  const processColumns: ColumnsType<ProcessCoefficient> = [
    { title: '阶段', dataIndex: 'stage', key: 'stage', width: 100 },
    {
      title: '系数', dataIndex: 'coefficient', key: 'coefficient', width: 100,
      render: (value: number, _: ProcessCoefficient, index: number) => (
        <InputNumber min={0} max={1} step={0.01} precision={2} value={value} onChange={(val) => {
          const newConfig = [...processCoefficientConfig]
          newConfig[index].coefficient = val || 0.1
          setProcessCoefficientConfig(newConfig)
        }} style={{ width: 80 }} size="small" />
      ),
    },
    { title: '', key: 'action', width: 40, render: (_, record) => <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete('process', record.stage)} /> },
  ]

  // 技术栈系数表格列
  const techStackColumns: ColumnsType<TechStackCoefficient> = [
    { title: '技术类型', dataIndex: 'techType', key: 'techType', width: 120 },
    {
      title: '系数', dataIndex: 'coefficient', key: 'coefficient', width: 100,
      render: (value: number, _: TechStackCoefficient, index: number) => (
        <InputNumber min={1} max={2} step={0.1} precision={2} value={value} onChange={(val) => {
          const newConfig = [...techStackCoefficientConfig]
          newConfig[index].coefficient = val || 1
          setTechStackCoefficientConfig(newConfig)
        }} style={{ width: 80 }} size="small" />
      ),
    },
    { title: '', key: 'action', width: 40, render: (_, record) => <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete('techStack', record.techType)} /> },
  ]

  // 单价表格列
  const unitPriceColumns: ColumnsType<UnitPrice> = [
    { title: '角色', dataIndex: 'role', key: 'role', width: 100 },
    {
      title: '单价(元/天)', dataIndex: 'price', key: 'price', width: 120,
      render: (value: number, _: UnitPrice, index: number) => (
        <InputNumber min={500} max={5000} step={100} value={value} onChange={(val) => {
          const newConfig = [...unitPriceConfig]
          newConfig[index].price = val || 1000
          setUnitPriceConfig(newConfig)
        }} style={{ width: 100 }} size="small" />
      ),
    },
    { title: '', key: 'action', width: 40, render: (_, record) => <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete('unitPrice', record.role)} /> },
  ]

  // 弹窗表单
  const renderModalForm = () => {
    switch (modalType) {
      case 'complexity':
        return (
          <>
            <Form.Item name="level" label="复杂度等级" rules={[{ required: true }]}>
              <Input placeholder="如：简单、中等、复杂" />
            </Form.Item>
            <Form.Item name="workdays" label="基准人天" rules={[{ required: true }]}>
              <InputNumber min={1} max={30} style={{ width: '100%' }} />
            </Form.Item>
          </>
        )
      case 'system':
        return (
          <>
            <Form.Item name="systemCount" label="关联系统数" rules={[{ required: true }]}>
              <InputNumber min={1} max={10} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="coefficient" label="系数" rules={[{ required: true }]}>
              <InputNumber min={1} max={3} step={0.1} precision={2} style={{ width: '100%' }} />
            </Form.Item>
          </>
        )
      case 'process':
        return (
          <>
            <Form.Item name="stage" label="阶段名称" rules={[{ required: true }]}>
              <Input placeholder="如：需求分析、开发" />
            </Form.Item>
            <Form.Item name="coefficient" label="系数" rules={[{ required: true }]}>
              <InputNumber min={0} max={1} step={0.01} precision={2} style={{ width: '100%' }} />
            </Form.Item>
          </>
        )
      case 'techStack':
        return (
          <>
            <Form.Item name="techType" label="技术类型" rules={[{ required: true }]}>
              <Input placeholder="如：常规技术、新技术" />
            </Form.Item>
            <Form.Item name="coefficient" label="系数" rules={[{ required: true }]}>
              <InputNumber min={1} max={2} step={0.1} precision={2} style={{ width: '100%' }} />
            </Form.Item>
          </>
        )
      case 'unitPrice':
        return (
          <>
            <Form.Item name="role" label="角色名称" rules={[{ required: true }]}>
              <Input placeholder="如：项目经理、高级开发" />
            </Form.Item>
            <Form.Item name="price" label="人天单价(元)" rules={[{ required: true }]}>
              <InputNumber min={500} max={5000} step={100} style={{ width: '100%' }} />
            </Form.Item>
          </>
        )
      default:
        return null
    }
  }

  const modalTitles: Record<string, string> = {
    complexity: '新增复杂度等级',
    system: '新增系统关联度',
    process: '新增流程阶段',
    techStack: '新增技术类型',
    unitPrice: '新增角色单价',
  }

  if (!projectId) {
    return (
      <div className="page-container">
        <PageTitle title="参数配置" icon={<SettingOutlined />} />
        <EstimateSteps current={currentStep} />
        <Card style={{ borderRadius: 12, textAlign: 'center', padding: 32 }}>
          <Text type="secondary">请从项目列表中选择项目进行配置</Text>
          <br />
          <Button type="primary" onClick={() => navigate('/cost-estimate/upload')} style={{ marginTop: 16, borderRadius: 8 }}>
            新建预估
          </Button>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="page-container">
        <Card style={{ borderRadius: 12 }}>
          <Spin size="large" tip="加载配置..." />
        </Card>
      </div>
    )
  }

  return (
    <div className="page-container">
      <PageTitle
        title="参数配置"
        description="根据项目实际情况调整计算参数"
        icon={<SettingOutlined />}
      />
      <EstimateSteps current={currentStep} />

      {/* 配置卡片 - 紧凑布局 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} md={12} lg={8}>
          <Card
            title={<span style={{ fontSize: 14 }}>复杂度基准</span>}
            size="small"
            style={{ borderRadius: 12 }}
            extra={<Button type="link" size="small" icon={<PlusOutlined />} onClick={() => openAddModal('complexity')}>新增</Button>}
          >
            {complexityConfig.length > 0 ? (
              <Table columns={complexityColumns} dataSource={complexityConfig} rowKey="level" pagination={false} size="small" />
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无配置" />}
          </Card>
        </Col>

        <Col xs={24} md={12} lg={8}>
          <Card
            title={<span style={{ fontSize: 14 }}>系统关联系数</span>}
            size="small"
            style={{ borderRadius: 12 }}
            extra={<Button type="link" size="small" icon={<PlusOutlined />} onClick={() => openAddModal('system')}>新增</Button>}
          >
            {systemCoefficientConfig.length > 0 ? (
              <Table columns={systemColumns} dataSource={systemCoefficientConfig} rowKey="systemCount" pagination={false} size="small" />
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无配置" />}
          </Card>
        </Col>

        <Col xs={24} md={12} lg={8}>
          <Card
            title={<span style={{ fontSize: 14 }}>流程系数</span>}
            size="small"
            style={{ borderRadius: 12 }}
            extra={<Button type="link" size="small" icon={<PlusOutlined />} onClick={() => openAddModal('process')}>新增</Button>}
          >
            {processCoefficientConfig.length > 0 ? (
              <Table columns={processColumns} dataSource={processCoefficientConfig} rowKey="stage" pagination={false} size="small" />
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无配置" />}
          </Card>
        </Col>

        <Col xs={24} md={12} lg={8}>
          <Card
            title={<span style={{ fontSize: 14 }}>技术栈系数</span>}
            size="small"
            style={{ borderRadius: 12 }}
            extra={<Button type="link" size="small" icon={<PlusOutlined />} onClick={() => openAddModal('techStack')}>新增</Button>}
          >
            {techStackCoefficientConfig.length > 0 ? (
              <Table columns={techStackColumns} dataSource={techStackCoefficientConfig} rowKey="techType" pagination={false} size="small" />
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无配置" />}
          </Card>
        </Col>

        <Col xs={24} md={12} lg={8}>
          <Card
            title={<span style={{ fontSize: 14 }}>人天单价</span>}
            size="small"
            style={{ borderRadius: 12 }}
            extra={<Button type="link" size="small" icon={<PlusOutlined />} onClick={() => openAddModal('unitPrice')}>新增</Button>}
          >
            {unitPriceConfig.length > 0 ? (
              <Table columns={unitPriceColumns} dataSource={unitPriceConfig} rowKey="role" pagination={false} size="small" />
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无配置" />}
          </Card>
        </Col>

        <Col xs={24} md={12} lg={8}>
          <Card title={<span style={{ fontSize: 14 }}>管理系数</span>} size="small" style={{ borderRadius: 12 }}>
            <div style={{ paddingTop: 8 }}>
              <Form layout="inline">
                <Form.Item label="系数" style={{ marginBottom: 0 }}>
                  <InputNumber
                    min={0}
                    max={0.5}
                    step={0.01}
                    precision={2}
                    value={managementCoefficient}
                    onChange={(val) => setManagementCoefficient(val || 0.15)}
                    style={{ width: 100 }}
                    size="small"
                  />
                </Form.Item>
                <Tooltip title="建议范围: 0.10 - 0.20">
                  <Text type="secondary" style={{ fontSize: 12 }}>当前: {managementCoefficient.toFixed(2)}</Text>
                </Tooltip>
              </Form>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 操作按钮 */}
      <Card style={{ borderRadius: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button onClick={() => navigate(`/cost-estimate/ai-analysis?projectId=${projectId}`)} style={{ borderRadius: 8 }}>
            <ArrowLeftOutlined style={{ marginRight: 8 }} />
            上一步
          </Button>
          <div style={{ display: 'flex', gap: 12 }}>
            <Button icon={<SaveOutlined />} onClick={handleSaveConfig} loading={saving} style={{ borderRadius: 8 }}>
              保存配置
            </Button>
            <Button type="primary" onClick={handleNext} loading={saving} style={{ borderRadius: 8, fontWeight: 500 }}>
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
        okText="确认"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          {renderModalForm()}
        </Form>
      </Modal>
    </div>
  )
}