import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Card,
  Steps,
  Button,
  Space,
  Typography,
  message,
  Spin,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Alert,
  Descriptions,
  DatePicker,
  Select,
  Empty,
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

interface MemberFormData {
  key: string
  memberId?: number
  name: string
  level: MemberLevel
  dailyCost: number
  entryTime: string | null
  leaveTime: string | null
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
          if (data.teamMembers && data.teamMembers.length > 0) {
            setMembers(
              data.teamMembers.map((m, index) => ({
                key: `member_${index}_${Date.now()}`,
                memberId: m.memberId,
                name: m.name,
                level: m.level,
                dailyCost: m.dailyCost,
                entryTime: m.entryTime || null,
                leaveTime: m.leaveTime || null,
              }))
            )
          }
        }
      } catch (error) {
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
        <InputNumber
          value={value}
          onChange={(v) => handleMemberChange(record.key, 'name', v)}
          placeholder="请输入姓名"
          style={{ width: '100%' }}
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
      width: 120,
      render: (value: number) => (
        <Text style={{ color: '#165DFF' }}>
          {value ? value.toFixed(2) : '-'}
        </Text>
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
          style={{ width: '100%' }}
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
          style={{ width: '100%' }}
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
      // 先保存调整后的成员
      await consumptionApi.adjustMembers(Number(projectId), validMembers.map((m) => ({
        memberId: m.memberId,
        name: m.name,
        level: m.level,
        dailyCost: m.dailyCost,
        entryTime: m.entryTime,
        leaveTime: m.leaveTime,
      })))

      // 重新计算
      const calcResponse = await consumptionApi.calculateCost(Number(projectId))
      if (calcResponse.data.code === 0 || calcResponse.data.code === 200) {
        message.success('重新计算完成')
        const data = calcResponse.data.data as CostConsumption
        setResult(data)
        // 更新成员列表
        if (data.teamMembers && data.teamMembers.length > 0) {
          setMembers(
            data.teamMembers.map((m, index) => ({
              key: `member_${index}_${Date.now()}`,
              memberId: m.memberId,
              name: m.name,
              level: m.level,
              dailyCost: m.dailyCost,
              entryTime: m.entryTime || null,
              leaveTime: m.leaveTime || null,
            }))
          )
        }
      }
    } catch (error) {
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
        memberId: m.memberId,
        name: m.name,
        level: m.level,
        dailyCost: m.dailyCost,
        entryTime: m.entryTime,
        leaveTime: m.leaveTime,
      })))

      message.success('项目保存成功')
      navigate('/dashboard')
    } catch (error) {
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
        <Card>
          <Spin size="large" tip="加载结果数据..." />
        </Card>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="page-container">
        <Card>
          <Steps current={currentStep} items={stepItems} />
        </Card>
        <Card style={{ marginTop: 24 }}>
          <Empty description="暂无结果数据，请先完成信息录入" />
          <Button
            type="primary"
            onClick={() => navigate('/cost-consumption/input')}
            style={{ marginTop: 16 }}
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
      <Card className="card-margin">
        <Steps current={currentStep} items={stepItems} style={{ marginBottom: 24 }} />
      </Card>

      {/* 核心指标卡片 */}
      <Row gutter={[24, 24]}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="可消耗成本(万元)"
              value={result.availableCost}
              precision={2}
              valueStyle={{
                color: isOverBudget ? '#F53F3F' : '#00B42A',
              }}
              suffix={isOverBudget ? (
                <Tag color="error" icon={<ExclamationCircleOutlined />} style={{ marginLeft: 8 }}>
                  已超支
                </Tag>
              ) : null}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="日人力成本(万元)"
              value={result.dailyManpowerCost}
              precision={2}
              valueStyle={{ color: '#165DFF' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="可消耗天数"
              value={result.availableDays}
              precision={1}
              suffix="天"
              valueStyle={{
                color: result.availableDays > 0 ? '#00B42A' : '#F53F3F',
              }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="燃尽日期"
              value={result.burnoutDate || '-'}
              valueStyle={{
                color: result.burnoutDate ? '#FF7D00' : '#86909C',
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* 超支警告 */}
      {isOverBudget && (
        <Alert
          type="error"
          message="成本超支警告"
          description="当前可消耗成本为负数，项目已超支。请调整人员配置或重新核算。"
          showIcon
          style={{ marginTop: 24 }}
        />
      )}

      {/* 计算公式说明卡片 */}
      <Card className="card-margin" style={{ marginTop: 24 }}>
        <Title level={4} style={{ marginBottom: 16 }}>
          计算公式说明
        </Title>
        <Descriptions column={1} bordered>
          <Descriptions.Item label="可消耗成本">
            <Text code>
              合同金额 × (1 - 售前比例) × (1 - 税率) - 外采人力成本 - 外采软件成本 - 当前人力成本
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="日人力成本">
            <Text code>
              Σ(成员日成本) = 成员等级对应日成本之和
            </Text>
            <Text type="secondary" style={{ marginLeft: 8 }}>
              (P5: 0.16, P6: 0.21, P7: 0.26, P8: 0.36 万元/天)
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="可消耗天数">
            <Text code>
              可消耗成本 / 日人力成本
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="燃尽日期">
            <Text code>
              当前日期 + 可消耗天数
            </Text>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 项目基本信息 */}
      <Card className="card-margin" style={{ marginTop: 24 }}>
        <Title level={4} style={{ marginBottom: 16 }}>
          项目基本信息
        </Title>
        <Descriptions column={2} bordered>
          <Descriptions.Item label="合同金额">
            {result.contractAmount?.toFixed(2) || '-'} 万元
          </Descriptions.Item>
          <Descriptions.Item label="售前比例">
            {result.preSaleRatio ? `${(result.preSaleRatio * 100).toFixed(2)}%` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="税率">
            {result.taxRate ? `${(result.taxRate * 100).toFixed(2)}%` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="外采人力成本">
            {result.externalLaborCost?.toFixed(2) || '-'} 万元
          </Descriptions.Item>
          <Descriptions.Item label="外采软件成本">
            {result.externalSoftwareCost?.toFixed(2) || '-'} 万元
          </Descriptions.Item>
          <Descriptions.Item label="当前人力成本">
            {result.currentManpowerCost?.toFixed(2) || '-'} 万元
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 人员方案调整区域 */}
      <Card className="card-margin" style={{ marginTop: 24 }}>
        <Title level={4} style={{ marginBottom: 16 }}>
          <TeamOutlined style={{ marginRight: 8 }} />
          人员方案调整
        </Title>

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
                    <Text strong>{members.length} 人</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2}>
                    <Text strong style={{ color: '#165DFF' }}>
                      {members.reduce((sum, m) => sum + (m.dailyCost || 0), 0).toFixed(2)} 万元/天
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

        <Space style={{ marginTop: 16, width: '100%', justifyContent: 'space-between' }}>
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={handleAddMember}
          >
            新增成员
          </Button>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={handleRecalculate}
            loading={recalculating}
          >
            重新计算
          </Button>
        </Space>
      </Card>

      {/* 操作按钮 */}
      <Card style={{ marginTop: 24 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Button onClick={() => navigate('/dashboard')}>
            返回首页
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSaveProject}
            loading={saving}
          >
            保存项目
          </Button>
        </Space>
      </Card>
    </div>
  )
}