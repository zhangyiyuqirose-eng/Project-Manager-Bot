import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Card,
  Steps,
  Form,
  InputNumber,
  Button,
  Space,
  Typography,
  message,
  Spin,
  Row,
  Col,
  Table,
} from 'antd'
import {
  FileTextOutlined,
  SettingOutlined,
  BarChartOutlined,
  SaveOutlined,
  CalculatorOutlined,
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

const { Text } = Typography

// 步骤条配置
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

  // 加载默认参数
  useEffect(() => {
    const loadDefaultConfig = async () => {
      setLoading(true)
      try {
        const response = await estimateApi.getDefaultConfig()
        if (response.data.code === 0 || response.data.code === 200) {
          const config: EstimateConfig = response.data.data
          if (config) {
            setComplexityConfig(config.complexityConfig || defaultComplexityConfig)
            setSystemCoefficientConfig(config.systemCoefficientConfig || defaultSystemCoefficientConfig)
            setProcessCoefficientConfig(config.processCoefficientConfig || defaultProcessCoefficientConfig)
            setTechStackCoefficientConfig(config.techStackCoefficientConfig || defaultTechStackCoefficientConfig)
            setUnitPriceConfig(config.unitPriceConfig || defaultUnitPriceConfig)
            setManagementCoefficient(config.managementCoefficient || 0.15)
          }
        }
      } catch (error) {
        // 使用默认配置
        message.info('使用默认配置参数')
      } finally {
        setLoading(false)
      }
    }

    loadDefaultConfig()
  }, [])

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
    } catch (error) {
      message.error('配置保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 开始计算
  const handleCalculate = async () => {
    if (!projectId) {
      message.warning('缺少项目ID，无法开始计算')
      return
    }

    setCalculating(true)
    try {
      // 先保存配置
      const config: EstimateConfig = {
        complexityConfig,
        systemCoefficientConfig,
        processCoefficientConfig,
        techStackCoefficientConfig,
        unitPriceConfig,
        managementCoefficient,
      }

      await estimateApi.saveConfig(Number(projectId), config)

      // 开始计算
      const response = await estimateApi.calculate(Number(projectId))
      if (response.data.code === 0 || response.data.code === 200) {
        message.success('计算完成，即将跳转到结果页面')
        setCurrentStep(2)
        setTimeout(() => {
          navigate(`/cost-estimate/result?projectId=${projectId}`)
        }, 1000)
      }
    } catch (error) {
      message.error('计算失败，请检查配置参数')
    } finally {
      setCalculating(false)
    }
  }

  // 复杂度基准表格列配置
  const complexityColumns: ColumnsType<ComplexityLevel> = [
    {
      title: '复杂度等级',
      dataIndex: 'level',
      key: 'level',
      width: 120,
    },
    {
      title: '基准人天',
      dataIndex: 'workdays',
      key: 'workdays',
      width: 150,
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
          style={{ width: '100%' }}
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
    },
    {
      title: '系数',
      dataIndex: 'coefficient',
      key: 'coefficient',
      width: 150,
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
          style={{ width: '100%' }}
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
    },
    {
      title: '系数',
      dataIndex: 'coefficient',
      key: 'coefficient',
      width: 150,
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
          style={{ width: '100%' }}
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
    },
    {
      title: '系数',
      dataIndex: 'coefficient',
      key: 'coefficient',
      width: 150,
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
          style={{ width: '100%' }}
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
    },
    {
      title: '单价(元/天)',
      dataIndex: 'price',
      key: 'price',
      width: 150,
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
          style={{ width: '100%' }}
        />
      ),
    },
  ]

  if (loading) {
    return (
      <div className="page-container">
        <Card>
          <Spin size="large" tip="加载默认配置..." />
        </Card>
      </div>
    )
  }

  return (
    <div className="page-container">
      {/* 步骤条 */}
      <Card className="card-margin">
        <Steps current={currentStep} items={stepItems} />
      </Card>

      {/* 配置卡片 */}
      <Row gutter={[24, 24]}>
        {/* 复杂度基准配置 */}
        <Col xs={24} lg={12}>
          <Card
            title="复杂度基准配置"
            extra={<Text type="secondary">各复杂度等级对应基准人天</Text>}
          >
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
            title="系统关联度系数配置"
            extra={<Text type="secondary">关联系统数量对应系数</Text>}
          >
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
            title="流程系数配置"
            extra={<Text type="secondary">各阶段工作量分配系数</Text>}
          >
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
            title="技术栈难度系数配置"
            extra={<Text type="secondary">不同技术类型难度系数</Text>}
          >
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
            title="人天单价配置"
            extra={<Text type="secondary">各角色人天单价(元)</Text>}
          >
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
            title="管理系数配置"
            extra={<Text type="secondary">项目管理成本系数</Text>}
          >
            <Form layout="inline">
              <Form.Item label="管理系数" style={{ marginBottom: 0 }}>
                <InputNumber
                  min={0}
                  max={0.5}
                  step={0.01}
                  precision={2}
                  value={managementCoefficient}
                  onChange={(val) => setManagementCoefficient(val || 0.15)}
                  style={{ width: 150 }}
                />
              </Form.Item>
              <Text type="secondary" style={{ marginLeft: 16 }}>
                建议范围: 0.10 - 0.20
              </Text>
            </Form>
          </Card>
        </Col>
      </Row>

      {/* 操作按钮 */}
      <Card style={{ marginTop: 24 }}>
        <Space>
          <Button onClick={() => navigate('/cost-estimate/upload')}>
            上一步：文件上传
          </Button>
          <Button
            icon={<SaveOutlined />}
            onClick={handleSaveConfig}
            loading={saving}
          >
            保存参数模板
          </Button>
          <Button
            type="primary"
            icon={<CalculatorOutlined />}
            onClick={handleCalculate}
            loading={calculating}
          >
            开始计算
          </Button>
        </Space>
      </Card>
    </div>
  )
}