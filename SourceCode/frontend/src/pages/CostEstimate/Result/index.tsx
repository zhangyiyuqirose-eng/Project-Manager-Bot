import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Card,
  Steps,
  Tabs,
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
  FileTextOutlined,
  SettingOutlined,
  BarChartOutlined,
  ReloadOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { Pie, Column } from '@ant-design/charts'
import { estimateApi } from '@/api'
import type {
  EstimateResult,
  StageBreakdown,
  CalculationTrace,
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

export default function CostEstimateResult() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('projectId')

  const [currentStep] = useState(2)
  const [loading, setLoading] = useState(true)
  const [recalculating, setRecalculating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  // 结果数据
  const [result, setResult] = useState<EstimateResult | null>(null)

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

  // 重新计算
  const handleRecalculate = async () => {
    if (!projectId) return

    setRecalculating(true)
    try {
      const response = await estimateApi.calculate(Number(projectId))
      if (response.data.code === 0 || response.data.code === 200) {
        message.success('重新计算完成')
        setResult(response.data.data)
      }
    } catch (error) {
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
      link.download = `成本预估报告_${projectId}_${new Date().toISOString().slice(0, 10)}.xlsx`
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

  // 团队工作量饼图配置
  const teamPieConfig = {
    appendPadding: 10,
    data: result?.teamBreakdown?.map((item) => ({
      type: item.team,
      value: item.workdays,
    })) || [],
    angleField: 'value',
    colorField: 'type',
    radius: 0.8,
    innerRadius: 0.6,
    label: {
      type: 'inner',
      offset: '-50%',
      content: '{value}',
      style: {
        textAlign: 'center',
        fontSize: 14,
      },
    },
    legend: {
      position: 'bottom' as const,
    },
    interactions: [
      {
        type: 'element-selected',
      },
      {
        type: 'element-active',
      },
    ],
    statistic: {
      title: {
        content: '总人天',
        offsetY: -8,
        style: {
          fontSize: '14px',
        },
      },
      content: {
        content: result?.totalManDay?.toFixed(1) || '0',
        offsetY: 4,
        style: {
          fontSize: '24px',
        },
      },
    },
  }

  // 各阶段工作量柱状图配置
  const stageColumnConfig = {
    data: result?.stageBreakdown?.map((item) => ({
      stage: item.stage,
      workdays: item.workdays,
      cost: item.cost,
    })) || [],
    xField: 'stage',
    yField: 'workdays',
    color: '#165DFF',
    label: {
      position: 'top' as const,
      style: {
        fill: '#1D2129',
        fontSize: 12,
      },
    },
    meta: {
      stage: {
        alias: '阶段',
      },
      workdays: {
        alias: '人天',
      },
    },
    columnStyle: {
      radius: [4, 4, 0, 0],
    },
  }

  // 阶段详细分解表格列配置
  const stageColumns: ColumnsType<StageBreakdown> = [
    {
      title: '阶段',
      dataIndex: 'stage',
      key: 'stage',
      width: 120,
    },
    {
      title: '人天',
      dataIndex: 'workdays',
      key: 'workdays',
      width: 100,
      render: (value: number) => value.toFixed(1),
    },
    {
      title: '成本(万元)',
      dataIndex: 'cost',
      key: 'cost',
      width: 120,
      render: (value: number) => value.toFixed(2),
    },
    {
      title: '占比',
      dataIndex: 'ratio',
      key: 'ratio',
      width: 100,
      render: (value: number) => (
        <Progress
          percent={value * 100}
          size="small"
          format={(percent) => `${percent?.toFixed(1)}%`}
        />
      ),
    },
  ]

  // 功能模块详细分析表格列配置（从计算轨迹中提取）
  const moduleColumns: ColumnsType<CalculationTrace> = [
    {
      title: '功能模块',
      dataIndex: 'functionName',
      key: 'functionName',
      width: 150,
    },
    {
      title: '复杂度基准',
      dataIndex: 'complexityBase',
      key: 'complexityBase',
      width: 100,
      render: (value: number) => value.toFixed(1),
    },
    {
      title: '系统系数',
      dataIndex: 'systemCoefficient',
      key: 'systemCoefficient',
      width: 80,
      render: (value: number) => value.toFixed(2),
    },
    {
      title: '流程系数',
      dataIndex: 'processCoefficient',
      key: 'processCoefficient',
      width: 80,
      render: (value: number) => value.toFixed(2),
    },
    {
      title: '技术栈系数',
      dataIndex: 'techStackCoefficient',
      key: 'techStackCoefficient',
      width: 80,
      render: (value: number) => value.toFixed(2),
    },
    {
      title: '管理系数',
      dataIndex: 'managementCoefficient',
      key: 'managementCoefficient',
      width: 80,
      render: (value: number) => value.toFixed(2),
    },
    {
      title: '计算结果(人天)',
      dataIndex: 'result',
      key: 'result',
      width: 120,
      render: (value: number) => (
        <Text strong style={{ color: '#165DFF' }}>
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
        <Text code style={{ fontSize: 12 }}>
          {value}
        </Text>
      ),
    },
    {
      title: '结果',
      dataIndex: 'result',
      key: 'result',
      width: 100,
      render: (value: number) => value.toFixed(1),
    },
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
    },
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
          <Empty description="暂无结果数据，请先完成参数配置并开始计算" />
          <Button
            type="primary"
            onClick={() => navigate(`/cost-estimate/config?projectId=${projectId}`)}
            style={{ marginTop: 16 }}
          >
            前往参数配置
          </Button>
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

      {/* Tab切换 */}
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'overview',
              label: '总览视图',
              children: (
                <div>
                  {/* 核心指标卡片 */}
                  <Row gutter={[24, 24]}>
                    <Col xs={12} sm={6}>
                      <Card>
                        <Statistic
                          title="总人天"
                          value={result.totalManDay}
                          suffix="天"
                          precision={1}
                          valueStyle={{ color: '#165DFF' }}
                        />
                      </Card>
                    </Col>
                    <Col xs={12} sm={6}>
                      <Card>
                        <Statistic
                          title="总成本"
                          value={result.totalCost}
                          suffix="万元"
                          precision={2}
                          valueStyle={{ color: '#F53F3F' }}
                        />
                      </Card>
                    </Col>
                    <Col xs={12} sm={6}>
                      <Card>
                        <Statistic
                          title="功能模块"
                          value={result.moduleCount}
                          suffix="个"
                          valueStyle={{ color: '#00B42A' }}
                        />
                      </Card>
                    </Col>
                    <Col xs={12} sm={6}>
                      <Card>
                        <Statistic
                          title="人月"
                          value={result.manMonth}
                          suffix="月"
                          precision={1}
                          valueStyle={{ color: '#FF7D00' }}
                        />
                      </Card>
                    </Col>
                  </Row>

                  {/* 图表区域 */}
                  <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
                    <Col xs={24} lg={12}>
                      <Card title="团队工作量分布">
                        <Pie {...teamPieConfig} />
                      </Card>
                    </Col>
                    <Col xs={24} lg={12}>
                      <Card title="各阶段工作量">
                        <Column {...stageColumnConfig} />
                      </Card>
                    </Col>
                  </Row>
                </div>
              ),
            },
            {
              key: 'detail',
              label: '详细分析视图',
              children: (
                <div>
                  {/* 阶段详细分解表 */}
                  <Card title="阶段详细分解" className="card-margin">
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
                              <Text strong>{result.totalManDay.toFixed(1)}</Text>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={2}>
                              <Text strong>{result.totalCost.toFixed(2)}</Text>
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
                  <Card title="功能模块详细分析">
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
              label: '合规校验视图',
              children: (
                <div>
                  {/* 占比合规校验结果 */}
                  <Card title="占比合规校验结果" className="card-margin">
                    <Row gutter={[16, 16]}>
                      {complianceChecks.map((check) => (
                        <Col xs={24} sm={12} md={8} key={check.stage}>
                          <Card size="small">
                            <Descriptions column={1} size="small">
                              <Descriptions.Item label="阶段">
                                {check.stage}
                              </Descriptions.Item>
                              <Descriptions.Item label="实际占比">
                                {(check.actualRatio * 100).toFixed(1)}%
                              </Descriptions.Item>
                              <Descriptions.Item label="预期范围">
                                {(check.expectedMin * 100).toFixed(1)}% - {(check.expectedMax * 100).toFixed(1)}%
                              </Descriptions.Item>
                              <Descriptions.Item label="校验结果">
                                {check.isCompliant ? (
                                  <Tag color="success" icon={<CheckCircleOutlined />}>
                                    合规
                                  </Tag>
                                ) : (
                                  <Tag color="error" icon={<ExclamationCircleOutlined />}>
                                    不合规
                                  </Tag>
                                )}
                              </Descriptions.Item>
                            </Descriptions>
                          </Card>
                        </Col>
                      ))}
                    </Row>

                    {/* 合规汇总 */}
                    <Alert
                      type={
                        complianceChecks.every((c) => c.isCompliant)
                          ? 'success'
                          : 'warning'
                      }
                      message={
                        complianceChecks.every((c) => c.isCompliant)
                          ? '所有阶段占比均符合预期范围，成本分配合理'
                          : `存在 ${complianceChecks.filter((c) => !c.isCompliant).length} 个阶段占比不合规，请检查计算参数`
                      }
                      showIcon
                      style={{ marginTop: 16 }}
                    />
                  </Card>

                  {/* 计算轨迹展示 */}
                  <Card title="计算轨迹">
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
      <Card style={{ marginTop: 24 }}>
        <Space>
          <Button onClick={() => navigate(`/cost-estimate/config?projectId=${projectId}`)}>
            上一步：参数配置
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRecalculate}
            loading={recalculating}
          >
            重新计算
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExportExcel}
            loading={exporting}
          >
            导出Excel报告
          </Button>
        </Space>
      </Card>
    </div>
  )
}