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
  Progress,
  Alert,
  Descriptions,
  Empty,
} from 'antd'
import {
  EditOutlined,
  BarChartOutlined,
  DownloadOutlined,
  ArrowLeftOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { Line, Column } from '@ant-design/charts'
import { deviationApi } from '@/api'
import type { CostDeviation, StageCost, TeamCost } from '@/types'

const { Paragraph } = Typography

// 步骤条配置
const stepItems = [
  {
    title: '信息录入',
    description: '上传截图与识别',
    icon: <EditOutlined />,
  },
  {
    title: '偏差分析',
    description: '成本偏差监控',
    icon: <BarChartOutlined />,
  },
]

// 团队列表
const teamList = ['产品', 'UI', '研发', '测试', '项目管理']

// 阶段列表
const stageList = ['需求', '设计', '开发', '技术测试', '性能测试', '投产']

export default function CostDeviationResult() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('projectId')

  const [currentStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  // 结果数据
  const [result, setResult] = useState<CostDeviation | null>(null)

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
        const response = await deviationApi.getResult(Number(projectId))
        if (response.data.code === 0 || response.data.code === 200) {
          setResult(response.data.data)
        }
      } catch (error) {
        message.error('获取结果数据失败')
      } finally {
        setLoading(false)
      }
    }

    loadResult()
  }, [projectId])

  // 导出报告
  const handleExportReport = async () => {
    if (!projectId) return

    setExporting(true)
    try {
      const response = await deviationApi.exportReport(Number(projectId))
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `成本偏差分析报告_${projectId}_${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      message.success('报告导出成功')
    } catch (error) {
      message.error('报告导出失败')
    } finally {
      setExporting(false)
    }
  }

  // 判断偏差状态
  const getDeviationStatus = (deviation: number) => {
    if (deviation <= 5) {
      return { status: 'success', text: '正常', color: '#00B42A' }
    } else if (deviation <= 15) {
      return { status: 'warning', text: '轻度偏差', color: '#FF7D00' }
    } else {
      return { status: 'error', text: '严重偏差', color: '#F53F3F' }
    }
  }

  // 成本消耗与任务进度对比条形图配置
  const progressComparisonConfig = {
    data: [
      {
        type: '成本消耗',
        value: result?.currentCostConsumption || 0,
      },
      {
        type: '预期消耗',
        value: (result?.totalContractAmount || 0) * (result?.taskProgress || 0) / 100,
      },
      {
        type: '任务进度',
        value: result?.taskProgress || 0,
      },
    ],
    xField: 'type',
    yField: 'value',
    color: ({ type }: { type: string }) => {
      if (type === '成本消耗') return '#F53F3F'
      if (type === '预期消耗') return '#165DFF'
      return '#00B42A'
    },
    label: {
      position: 'top' as const,
      style: {
        fill: '#1D2129',
        fontSize: 12,
      },
      formatter: ({ type, value }: { type: string; value: number }) => {
        if (type === '任务进度') return `${value.toFixed(1)}%`
        return `${value.toFixed(2)}万`
      },
    },
    meta: {
      type: {
        alias: '类型',
      },
      value: {
        alias: '值',
      },
    },
    columnStyle: {
      radius: [4, 4, 0, 0],
    },
  }

  // 各阶段成本偏差折线图配置
  const stageLineConfig = {
    data: [
      ...(result?.expectedStages?.map((item) => ({
        stage: item.stage,
        type: '预期占比',
        value: item.expectedRatio * 100,
      })) || stageList.map((stage, index) => ({
        stage,
        type: '预期占比',
        value: [15, 20, 35, 15, 5, 10][index],
      }))),
      ...(result?.actualStages?.map((item) => ({
        stage: item.stage,
        type: '实际占比',
        value: item.actualRatio * 100,
      })) || []),
    ],
    xField: 'stage',
    yField: 'value',
    seriesField: 'type',
    color: ['#165DFF', '#F53F3F'],
    legend: {
      position: 'top' as const,
    },
    smooth: true,
    point: {
      size: 4,
      shape: 'circle',
    },
    label: {
      position: 'top' as const,
      style: {
        fontSize: 10,
      },
      formatter: ({ value }: { value: number }) => `${value.toFixed(1)}%`,
    },
    meta: {
      stage: {
        alias: '阶段',
      },
      value: {
        alias: '占比(%)',
      },
      type: {
        alias: '类型',
      },
    },
  }

  // 各团队成本双柱形图配置
  const teamColumnConfig = {
    data: [
      ...((result?.teamCosts?.map((item) => [
        {
          team: item.team,
          type: '预期成本',
          value: item.expectedCost,
        },
        {
          team: item.team,
          type: '实际成本',
          value: item.actualCost,
        },
      ])) || teamList.map((team) => [
        {
          team,
          type: '预期成本',
          value: 0,
        },
        {
          team,
          type: '实际成本',
          value: 0,
        },
      ])).flat(),
    ],
    xField: 'team',
    yField: 'value',
    seriesField: 'type',
    isGroup: true,
    color: ['#165DFF', '#F53F3F'],
    legend: {
      position: 'top' as const,
    },
    label: {
      position: 'top' as const,
      style: {
        fontSize: 10,
      },
      formatter: ({ value }: { value: number }) => `${value.toFixed(2)}万`,
    },
    meta: {
      team: {
        alias: '团队',
      },
      value: {
        alias: '成本(万元)',
      },
      type: {
        alias: '类型',
      },
    },
    columnStyle: {
      radius: [4, 4, 0, 0],
    },
  }

  // 阶段成本详细表格列配置
  const stageColumns: ColumnsType<StageCost> = [
    {
      title: '阶段',
      dataIndex: 'stage',
      key: 'stage',
      width: 100,
    },
    {
      title: '预期成本(万)',
      dataIndex: 'expectedCost',
      key: 'expectedCost',
      width: 120,
      render: (value: number) => value?.toFixed(2) || '-',
    },
    {
      title: '预期占比',
      dataIndex: 'expectedRatio',
      key: 'expectedRatio',
      width: 100,
      render: (value: number) => (
        <Progress
          percent={(value || 0) * 100}
          size="small"
          strokeColor="#165DFF"
          format={(percent) => `${percent?.toFixed(1)}%`}
        />
      ),
    },
    {
      title: '实际成本(万)',
      dataIndex: 'actualCost',
      key: 'actualCost',
      width: 120,
      render: (value: number) => value?.toFixed(2) || '-',
    },
    {
      title: '实际占比',
      dataIndex: 'actualRatio',
      key: 'actualRatio',
      width: 100,
      render: (value: number) => (
        <Progress
          percent={(value || 0) * 100}
          size="small"
          strokeColor="#F53F3F"
          format={(percent) => `${percent?.toFixed(1)}%`}
        />
      ),
    },
    {
      title: '偏差',
      dataIndex: 'deviation',
      key: 'deviation',
      width: 100,
      render: (value: number) => {
        const status = getDeviationStatus(value || 0)
        return (
          <Tag color={status.color}>
            {value?.toFixed(1)}% {status.text}
          </Tag>
        )
      },
    },
  ]

  // 团队成本详细表格列配置
  const teamColumns: ColumnsType<TeamCost> = [
    {
      title: '团队',
      dataIndex: 'team',
      key: 'team',
      width: 100,
    },
    {
      title: '预期成本(万)',
      dataIndex: 'expectedCost',
      key: 'expectedCost',
      width: 120,
      render: (value: number) => value?.toFixed(2) || '-',
    },
    {
      title: '实际成本(万)',
      dataIndex: 'actualCost',
      key: 'actualCost',
      width: 120,
      render: (value: number) => value?.toFixed(2) || '-',
    },
    {
      title: '偏差',
      dataIndex: 'deviation',
      key: 'deviation',
      width: 100,
      render: (value: number) => {
        const status = getDeviationStatus(value || 0)
        return (
          <Tag color={status.color}>
            {value?.toFixed(1)}% {status.text}
          </Tag>
        )
      },
    },
  ]

  if (loading) {
    return (
      <div className="page-container">
        <Card>
          <Spin size="large" tip="加载分析结果..." />
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
          <Empty description="暂无分析结果，请先完成信息录入" />
          <Button
            type="primary"
            onClick={() => navigate(`/cost-deviation/input`)}
            style={{ marginTop: 16 }}
          >
            前往信息录入
          </Button>
        </Card>
      </div>
    )
  }

  // 偏差状态判断
  const deviationStatus = getDeviationStatus(result.costDeviation)

  return (
    <div className="page-container">
      {/* 步骤条 */}
      <Card className="card-margin">
        <Steps current={currentStep} items={stepItems} />
      </Card>

      {/* 核心指标卡片 */}
      <Card className="card-margin" title="核心指标">
        <Row gutter={[24, 24]}>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="合同金额"
                value={result.totalContractAmount}
                suffix="万元"
                precision={2}
                valueStyle={{ color: '#165DFF' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="成本消耗"
                value={result.currentCostConsumption}
                suffix="万元"
                precision={2}
                valueStyle={{ color: '#F53F3F' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="任务进度"
                value={result.taskProgress}
                suffix="%"
                precision={1}
                valueStyle={{ color: '#00B42A' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="成本偏差"
                value={result.costDeviation}
                suffix="%"
                precision={1}
                valueStyle={{ color: deviationStatus.color }}
              />
              <Tag color={deviationStatus.color} style={{ marginTop: 8 }}>
                {deviationStatus.text}
              </Tag>
            </Card>
          </Col>
        </Row>

        {/* 偏差预警提示 */}
        {result.costDeviation > 15 && (
          <Alert
            type="error"
            message="成本偏差预警"
            description={`当前成本偏差 ${result.costDeviation.toFixed(1)}% 已超过15%阈值，建议立即采取措施控制成本`}
            showIcon
            icon={<ExclamationCircleOutlined />}
            style={{ marginTop: 16 }}
          />
        )}
        {result.costDeviation > 5 && result.costDeviation <= 15 && (
          <Alert
            type="warning"
            message="成本偏差提醒"
            description={`当前成本偏差 ${result.costDeviation.toFixed(1)}% 处于轻度偏差范围，请关注成本控制`}
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
        {result.costDeviation <= 5 && (
          <Alert
            type="success"
            message="成本控制良好"
            description="当前成本偏差在正常范围内，项目成本控制符合预期"
            showIcon
            icon={<CheckCircleOutlined />}
            style={{ marginTop: 16 }}
          />
        )}
      </Card>

      {/* 成本消耗与任务进度对比条形图 */}
      <Card className="card-margin" title="成本消耗与任务进度对比">
        <Paragraph type="secondary" style={{ marginBottom: 16 }}>
          对比当前成本消耗与任务进度对应的预期成本消耗，判断是否存在超前或滞后消耗
        </Paragraph>
        <Column {...progressComparisonConfig} height={200} />
      </Card>

      {/* 各阶段成本偏差折线图 */}
      <Card className="card-margin" title="各阶段成本偏差分析">
        <Paragraph type="secondary" style={{ marginBottom: 16 }}>
          横轴为项目各阶段，双折线分别展示预期成本占比与实际成本占比，直观显示偏差情况
        </Paragraph>
        <Row gutter={24}>
          <Col xs={24} lg={16}>
            <Line {...stageLineConfig} height={300} />
          </Col>
          <Col xs={24} lg={8}>
            <Card size="small" title="阶段偏差汇总">
              <Descriptions column={1} size="small">
                {result.actualStages?.map((stage) => (
                  <Descriptions.Item
                    key={stage.stage}
                    label={stage.stage}
                  >
                    <Tag color={getDeviationStatus(stage.deviation).color}>
                      偏差 {stage.deviation.toFixed(1)}%
                    </Tag>
                  </Descriptions.Item>
                ))}
              </Descriptions>
            </Card>
          </Col>
        </Row>
      </Card>

      {/* 各团队成本双柱形图 */}
      <Card className="card-margin" title="各团队成本对比分析">
        <Paragraph type="secondary" style={{ marginBottom: 16 }}>
          横轴为各团队（产品、UI、研发、测试、项目管理），双柱分别展示预期成本与实际成本
        </Paragraph>
        <Row gutter={24}>
          <Col xs={24} lg={16}>
            <Column {...teamColumnConfig} height={300} />
          </Col>
          <Col xs={24} lg={8}>
            <Card size="small" title="团队偏差汇总">
              <Descriptions column={1} size="small">
                {result.teamCosts?.map((team) => (
                  <Descriptions.Item
                    key={team.team}
                    label={team.team}
                  >
                    <Tag color={getDeviationStatus(team.deviation).color}>
                      偏差 {team.deviation.toFixed(1)}%
                    </Tag>
                  </Descriptions.Item>
                ))}
              </Descriptions>
            </Card>
          </Col>
        </Row>
      </Card>

      {/* AI人员调整建议 */}
      {result.aiSuggestion && (
        <Card className="card-margin" title="AI人员调整建议">
          <Alert
            type="info"
            icon={<InfoCircleOutlined />}
            showIcon
            message="智能分析建议"
            description={result.aiSuggestion}
          />
        </Card>
      )}

      {/* 详细成本分析表格 */}
      <Card className="card-margin" title="详细成本分析">
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={12}>
            <Card size="small" title="阶段成本明细">
              <Table
                columns={stageColumns}
                dataSource={result.actualStages || []}
                rowKey="stage"
                pagination={false}
                size="small"
                bordered
              />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card size="small" title="团队成本明细">
              <Table
                columns={teamColumns}
                dataSource={result.teamCosts || []}
                rowKey="team"
                pagination={false}
                size="small"
                bordered
              />
            </Card>
          </Col>
        </Row>
      </Card>

      {/* 操作按钮 */}
      <Card>
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(`/cost-deviation/input?projectId=${projectId}`)}
          >
            返回录入
          </Button>
          <Button onClick={() => navigate('/dashboard')}>
            返回首页
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExportReport}
            loading={exporting}
          >
            导出报告
          </Button>
        </Space>
      </Card>
    </div>
  )
}