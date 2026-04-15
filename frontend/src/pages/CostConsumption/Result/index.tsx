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
  DatePicker,
  Select,
  Input,
  InputNumber,
} from 'antd'
import {
  FormOutlined,
  BarChartOutlined,
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  TeamOutlined,
  DollarOutlined,
  FireOutlined,
  CalendarOutlined,
  RiseOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { consumptionApi } from '@/api'
import { MEMBER_LEVEL_DAILY_COST } from '@/types'
import type { MemberLevel, CostConsumption } from '@/types'

const { Title, Text } = Typography

// 步骤条配置
const stepItems = [
  {
    title: '信息录入',
    description: '录入项目信息',
    icon: <FormOutlined />,
  },
  {
    title: '成本核算',
    description: '查看核算结果',
    icon: <BarChartOutlined />,
  },
]

// 成员等级选项
const levelOptions: { value: MemberLevel; label: string }[] = [
  { value: 'P5', label: 'P5' },
  { value: 'P6', label: 'P6' },
  { value: 'P7', label: 'P7' },
  { value: 'P8', label: 'P8' },
]

// 部门选项
const departmentOptions = [
  { value: '客服', label: '客服' },
  { value: '公司领导', label: '公司领导' },
  { value: '办公室（党委办公室、党委宣传部）', label: '办公室（党委办公室、党委宣传部）' },
  { value: '产品研发部', label: '产品研发部' },
  { value: '财务部', label: '财务部' },
  { value: '大数据开发部', label: '大数据开发部' },
  { value: '互联网应用开发事业部', label: '互联网应用开发事业部' },
  { value: '集成运维部', label: '集成运维部' },
  { value: '技术创新事业部', label: '技术创新事业部' },
  { value: '人工智能部', label: '人工智能部' },
  { value: '实习生', label: '实习生' },
  { value: '项目管理部', label: '项目管理部' },
  { value: '银行转型部', label: '银行转型部' },
  { value: '云计算应用部', label: '云计算应用部' },
  { value: '市场营销部', label: '市场营销部' },
  { value: '审计部', label: '审计部' },
  { value: '纪委办公室', label: '纪委办公室' },
  { value: '效能研发部', label: '效能研发部' },
  { value: '党委组织部（人力资源部）', label: '党委组织部（人力资源部）' },
  { value: '党群工作部', label: '党群工作部' },
  { value: '苏州分公司', label: '苏州分公司' },
  { value: '信息安全部', label: '信息安全部' },
  { value: '数字运营部', label: '数字运营部' },
  { value: '京津冀对外拓展工作室', label: '京津冀对外拓展工作室' },
  { value: '三方人员', label: '三方人员' },
  { value: '员工服务', label: '员工服务' },
]

interface MemberFormData {
  key: string
  memberId?: number
  name: string
  department?: string
  level: MemberLevel
  dailyCost: number
  entryTime: string | null
  leaveTime: string | null
  isToEnd?: boolean
  role?: string
  reportedHours?: number
}

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
}

function StatCard({ title, value, suffix, precision, icon, color, gradient, status }: StatCardProps) {
  return (
    <Card
      style={{
        borderRadius: 16,
        border: '1px solid #f1f5f9',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          background: gradient,
          padding: '16px 16px',
          borderRadius: 12,
          marginBottom: 12,
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
      <div style={{ textAlign: 'center', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <Text
            strong
            style={{
              fontSize: 28,  // 调整字体大小，确保日期不换行
              color,
              fontWeight: 700,
            }}
          >
            {typeof value === 'number' && precision !== undefined ? value.toFixed(precision) : value}
          </Text>
          {suffix && (
            <Text type="secondary" style={{ fontSize: 14, marginLeft: 4 }}>
              {suffix}
            </Text>
          )}
          {status === 'error' && (
            <Tag
              icon={<ExclamationCircleOutlined />}
              style={{
                marginLeft: 8,
                borderRadius: 8,
                background: '#EF4444',
                color: '#fff',
                border: 'none',
              }}
            >
              已超支
            </Tag>
          )}
        </div>
      </div>
    </Card>
  )
}

export default function CostConsumptionResult() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('projectId')

  const [currentStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [recalculating, setRecalculating] = useState(false)
  const [saving, setSaving] = useState(false)

  // 结果数据
  const [result, setResult] = useState<CostConsumption | null>(null)

  // 成员列表数据（用于调整）
  const [members, setMembers] = useState<MemberFormData[]>([])

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
        const response = await consumptionApi.getResult(Number(projectId))
        if (response.data.code === 0 || response.data.code === 200) {
          const data = response.data.data as CostConsumption
          setResult(data)
          // 初始化成员列表
          if (data.members && data.members.length > 0) {
            setMembers(
              data.members.map((m, index) => ({
                key: `member_${index}_${Date.now()}`,
                memberId: m.id,
                name: m.name,
                level: m.level,
                dailyCost: m.dailyCost,
                entryTime: m.entryTime || null,
                leaveTime: m.leaveTime || null,
              }))
            )
          }
        }
      } catch {
        message.error('获取结果数据失败')
      } finally {
        setLoading(false)
      }
    }

    loadResult()
  }, [projectId])

  // 生成唯一key
  const generateKey = () => `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // 成员表格列配置
  const memberColumns: ColumnsType<MemberFormData> = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 120,
      render: (value: string, record) => (
        <Input
          value={value}
          onChange={(e) => handleMemberChange(record.key, 'name', e.target.value)}
          placeholder="请输入姓名"
          style={{ width: '100%', borderRadius: 8 }}
        />
      ),
    },
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
      width: 200,
      render: (value: string, record) => (
        <Select
          value={value || undefined}
          onChange={(v) => handleMemberChange(record.key, 'department', v)}
          options={departmentOptions}
          placeholder="请选择部门"
          style={{ width: '100%', borderRadius: 8 }}
          showSearch
          filterOption={(input, option) =>
            (option?.label || '').toLowerCase().includes(input.toLowerCase())
          }
        />
      ),
    },
    {
      title: '等级',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (value: MemberLevel, record) => (
        <Select
          value={value}
          onChange={(v: MemberLevel) => handleMemberLevelChange(record.key, v)}
          options={levelOptions}
          placeholder="请选择等级"
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '日成本(万元)',
      dataIndex: 'dailyCost',
      key: 'dailyCost',
      width: 100,
      render: (value: number) => (
        <Tag
          style={{
            borderRadius: 8,
            background: '#3B82F615',
            color: '#3B82F6',
            border: 'none',
            fontWeight: 500,
          }}
        >
          {value ? value.toFixed(2) : '-'}
        </Tag>
      ),
    },
    {
      title: '入项时间',
      dataIndex: 'entryTime',
      key: 'entryTime',
      width: 150,
      render: (value: string | null, record) => (
        <DatePicker
          value={value ? dayjs(value) : null}
          onChange={(date) =>
            handleMemberChange(record.key, 'entryTime', date ? date.format('YYYY-MM-DD') : null)
          }
          style={{ width: '100%', borderRadius: 8 }}
          placeholder="选择日期"
        />
      ),
    },
    {
      title: '离项时间',
      dataIndex: 'leaveTime',
      key: 'leaveTime',
      width: 150,
      render: (value: string | null, record) => (
        <DatePicker
          value={value ? dayjs(value) : null}
          onChange={(date) =>
            handleMemberChange(record.key, 'leaveTime', date ? date.format('YYYY-MM-DD') : null)
          }
          style={{ width: '100%', borderRadius: 8 }}
          placeholder="选择日期"
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDeleteMember(record.key)}
        />
      ),
    },
  ]

  // 更新成员字段
  const handleMemberChange = (
    key: string,
    field: keyof MemberFormData,
    value: string | number | null
  ) => {
    setMembers((prev) =>
      prev.map((m) => (m.key === key ? { ...m, [field]: value } : m))
    )
  }

  // 成员等级变更时自动回填日成本
  const handleMemberLevelChange = (key: string, level: MemberLevel) => {
    const dailyCost = MEMBER_LEVEL_DAILY_COST[level]
    setMembers((prev) =>
      prev.map((m) =>
        m.key === key ? { ...m, level, dailyCost } : m
      )
    )
  }

  // 新增成员
  const handleAddMember = () => {
    const newMember: MemberFormData = {
      key: generateKey(),
      name: '',
      department: '',
      level: 'P5' as MemberLevel,
      dailyCost: MEMBER_LEVEL_DAILY_COST['P5'],
      entryTime: null,
      leaveTime: null,
    }
    setMembers((prev) => [...prev, newMember])
  }

  // 删除成员
  const handleDeleteMember = (key: string) => {
    setMembers((prev) => prev.filter((m) => m.key !== key))
  }

  // 重新计算
  const handleRecalculate = async () => {
    if (!projectId) return

    // 验证成员数据
    const validMembers = members.filter((m) => m.name && m.level)
    if (validMembers.length === 0) {
      message.warning('请至少添加一名有效成员')
      return
    }

    setRecalculating(true)
    try {
      // 直接调用计算成本的接口，传递当前页面的成员数据
      const calcResponse = await consumptionApi.calculateCost(Number(projectId), validMembers)
      if (calcResponse.data.code === 0 || calcResponse.data.code === 200) {
        message.success('重新计算完成')
        const data = calcResponse.data.data as CostConsumption
        setResult(data)
        // 不更新成员列表，保留用户输入的信息

        // 在前端控制台输出计算过程
        if (data.calculationDetails) {
          console.log('=== 成本计算过程 ===')
          console.log('合同金额:', data.calculationDetails.contractAmount)
          console.log('售前比例:', data.calculationDetails.preSaleRatio)
          console.log('税率:', data.calculationDetails.taxRate)
          console.log('外采人力成本:', data.calculationDetails.externalLaborCost)
          console.log('外采软件成本:', data.calculationDetails.externalSoftwareCost)
          console.log('外采成本总计:', data.calculationDetails.externalCost)
          console.log('其他成本:', data.calculationDetails.otherCost)
          console.log('当前人力成本:', data.calculationDetails.currentManpowerCost)
          console.log('计算式:', data.calculationDetails.formula)
          console.log('计算式（具体数值）:', data.calculationDetails.formulaValues)
          console.log('计算结果 - 可消耗成本:', data.calculationDetails.availableCost)
        }
      }
    } catch {
      message.error('重新计算失败')
    } finally {
      setRecalculating(false)
    }
  }

  // 保存项目
  const handleSaveProject = async () => {
    if (!projectId) {
      message.warning('缺少项目ID')
      return
    }

    setSaving(true)
    try {
      // 保存成员调整
      const validMembers = members.filter((m) => m.name && m.level)
      await consumptionApi.adjustMembers(Number(projectId), validMembers.map((m) => ({
        name: m.name,
        department: m.department,
        level: m.level,
        dailyCost: m.dailyCost,
        entryTime: m.entryTime,
        leaveTime: m.leaveTime,
        role: m.role || '',
        reportedHours: m.reportedHours || 0,
      })))

      message.success('项目保存成功')
      navigate('/dashboard')
    } catch {
      message.error('项目保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 判断是否超支
  const isOverBudget = result?.availableCost !== undefined && result.availableCost < 0

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
          <BarChartOutlined style={{ fontSize: 48, color: '#64748b', marginBottom: 16 }} />
          <Title level={4} style={{ marginBottom: 8 }}>暂无结果数据</Title>
          <Text type="secondary" style={{ marginBottom: 24 }}>
            请先完成信息录入
          </Text>
          <Button
            type="primary"
            size="large"
            onClick={() => navigate('/cost-consumption/input')}
            style={{
              borderRadius: 12,
              height: 44,
              background: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
              border: 'none',
            }}
          >
            前往信息录入
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
            <BarChartOutlined style={{ fontSize: 32, color: '#fff' }} />
          </div>
          <div>
            <Title level={3} style={{ color: '#fff', margin: 0, marginBottom: 8 }}>
              成本核算结果
            </Title>
            <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 15 }}>
              查看成本消耗详情，调整人员配置优化成本结构
            </Text>
          </div>
        </div>
      </div>

      {/* 核心指标卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6} lg={4}>
          <StatCard
            title="可消耗成本"
            value={result.availableCost}
            suffix="万元"
            precision={2}
            icon={<DollarOutlined />}
            color={isOverBudget ? '#EF4444' : '#10B981'}
            gradient={isOverBudget ? 'linear-gradient(135deg, #EF4444 0%, #F87171 100%)' : 'linear-gradient(135deg, #10B981 0%, #34D399 100%)'}
            status={isOverBudget ? 'error' : 'success'}
          />
        </Col>
        <Col xs={12} sm={6} lg={4}>
          <StatCard
            title="日人力成本"
            value={result.dailyManpowerCost}
            suffix="万元"
            precision={2}
            icon={<RiseOutlined />}
            color="#3B82F6"
            gradient="linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%)"
          />
        </Col>
        <Col xs={12} sm={6} lg={4}>
          <StatCard
            title="外采成本"
            value={(result.externalLaborCost || 0) + (result.externalSoftwareCost || 0)}
            suffix="万元"
            precision={2}
            icon={<DollarOutlined />}
            color="#EC4899"
            gradient="linear-gradient(135deg, #EC4899 0%, #F472B6 100%)"
          />
        </Col>
        <Col xs={12} sm={6} lg={4}>
          <StatCard
            title="其它成本"
            value={result.otherCost || 0}
            suffix="万元"
            precision={2}
            icon={<DollarOutlined />}
            color="#64748b"
            gradient="linear-gradient(135deg, #64748b 0%, #94a3b8 100%)"
          />
        </Col>
        <Col xs={12} sm={6} lg={4}>
          <StatCard
            title="可消耗天数"
            value={Math.floor(result.availableDays)}
            suffix="天"
            icon={<CalendarOutlined />}
            color={result.availableDays > 0 ? '#10B981' : '#EF4444'}
            gradient="linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)"
          />
        </Col>
        <Col xs={12} sm={6} lg={4}>
          <StatCard
            title="燃尽日期"
            value={result.burnoutDate ? dayjs(result.burnoutDate).format('YYYY/MM/DD') : '-'}
            icon={<FireOutlined />}
            color={result.burnoutDate ? '#F59E0B' : '#64748b'}
            gradient="linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)"
          />
        </Col>
      </Row>

      {/* 燃尽日期计算说明 */}
      {result.burnoutDate && (
        <div style={{ 
          marginTop: 12, 
          marginBottom: 16,
          padding: '8px 12px',
          background: '#FFF7ED',
          borderRadius: 8,
          border: '1px solid #FED7AA',
          textAlign: 'center'
        }}>
          <Text style={{ fontSize: 13, color: 'red', fontWeight: 'bold' }}>
            ⚠️ 2027年及以后法定节假日未公布，结果暂按扣除周末计算，实际以国务院放假安排为准。
          </Text>
        </div>
      )}

      {/* 超支警告 */}
      {isOverBudget && (
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
              <Text strong style={{ fontSize: 16, color: '#EF4444' }}>成本超支警告</Text>
              <br />
              <Text type="secondary">当前可消耗成本为负数，项目已超支。请调整人员配置或重新核算。</Text>
            </div>
          </div>
        </Card>
      )}

      {/* 计算公式说明卡片 */}
      <Card
        style={{
          borderRadius: 20,
          marginBottom: 24,
          border: '1px solid #f1f5f9',
          padding: '16px 20px',
        }}
      >
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <DollarOutlined style={{ marginRight: 8, color: '#3B82F6' }} />
            <div style={{ 
              fontSize: '18px', 
              fontWeight: 600, 
              lineHeight: '1.5', 
              color: '#1D2129',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
            }}>
              计算公式说明
            </div>
          </div>

        </div>

        <Row gutter={[12, 16]}>
          <Col xs={24} md={12}>
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 12,
              }}
            >
              <div style={{ 
                fontSize: '15px', 
                fontWeight: 500, 
                lineHeight: '1.6', 
                color: '#272E3B',
                marginBottom: 8,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
              }}>
                可消耗成本
              </div>
              <div style={{ 
                fontSize: '16px', 
                fontWeight: 400, 
                lineHeight: '1.7', 
                color: '#1D2129',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
              }}>
                合同金额 × (1 - 售前比例-税率)  - 外采成本 - 当前人力成本
              </div>
            </div>
          </Col>
          <Col xs={24} md={12}>
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 12,
              }}
            >
              <div style={{ 
                fontSize: '15px', 
                fontWeight: 500, 
                lineHeight: '1.6', 
                color: '#272E3B',
                marginBottom: 8,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
              }}>
                日人力成本
              </div>
              <div style={{ 
                fontSize: '16px', 
                fontWeight: 400, 
                lineHeight: '1.7', 
                color: '#1D2129',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
              }}>
                Σ(成员日成本) = P5:0.16, P6:0.21, P7:0.26, P8:0.36 万/天
              </div>
            </div>
          </Col>
          <Col xs={24} md={12}>
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 12,
              }}
            >
              <div style={{ 
                fontSize: '15px', 
                fontWeight: 500, 
                lineHeight: '1.6', 
                color: '#272E3B',
                marginBottom: 8,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
              }}>
                可消耗天数
              </div>
              <div style={{ 
                fontSize: '16px', 
                fontWeight: 400, 
                lineHeight: '1.7', 
                color: '#1D2129',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
              }}>
                可消耗成本 / 日人力成本
              </div>
            </div>
          </Col>
          <Col xs={24} md={12}>
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 12,
              }}
            >
              <div style={{ 
                fontSize: '15px', 
                fontWeight: 500, 
                lineHeight: '1.6', 
                color: '#272E3B',
                marginBottom: 8,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
              }}>
                燃尽日期
              </div>
              <div style={{ 
                fontSize: '16px', 
                fontWeight: 400, 
                lineHeight: '1.7', 
                color: '#1D2129',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
              }}>
                当前日期 + 可消耗天数
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      {/* 人员方案调整区域 */}
      <Card
        style={{
          borderRadius: 20,
          marginBottom: 24,
          border: '1px solid #f1f5f9',
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <Title level={4} style={{ marginBottom: 4, fontWeight: 600 }}>
            <TeamOutlined style={{ marginRight: 8, color: '#F59E0B' }} />
            人员方案调整
          </Title>
          <Text type="secondary">调整团队成员配置，优化成本结构</Text>
        </div>

        <Table
          columns={memberColumns}
          dataSource={members}
          rowKey="key"
          pagination={false}
          locale={{ emptyText: '暂无成员，请点击添加' }}
          summary={() =>
            members.length > 0 ? (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0}>
                    <Text strong>合计</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1}>
                    <Tag
                      style={{
                        borderRadius: 8,
                        background: '#8B5CF615',
                        color: '#8B5CF6',
                        border: 'none',
                        fontWeight: 500,
                      }}
                    >
                      {members.length} 人
                    </Tag>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2}>
                    <Text strong style={{ color: '#3B82F6' }}>
                      {members.reduce((sum, m) => sum + (m.dailyCost || 0), 0).toFixed(2)} 万/天
                    </Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} />
                  <Table.Summary.Cell index={4} />
                  <Table.Summary.Cell index={5} />
                </Table.Summary.Row>
              </Table.Summary>
            ) : null
          }
        />

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={handleAddMember}
            style={{ borderRadius: 10 }}
          >
            新增成员
          </Button>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={handleRecalculate}
            loading={recalculating}
            style={{
              borderRadius: 10,
              background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
              border: 'none',
            }}
          >
            重新计算
          </Button>
        </div>
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
            onClick={() => navigate('/dashboard')}
            style={{ borderRadius: 12, height: 44 }}
          >
            <ArrowLeftOutlined style={{ marginRight: 8 }} />
            返回首页
          </Button>
          <Button
            type="primary"
            size="large"
            icon={<SaveOutlined />}
            onClick={handleSaveProject}
            loading={saving}
            style={{
              borderRadius: 12,
              height: 44,
              background: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
              border: 'none',
              fontWeight: 600,
            }}
          >
            保存项目
          </Button>
        </div>
      </Card>
    </div>
  )
}