import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Descriptions,
  Table,
  Tag,
  Button,
  Spin,
  Empty,
  Typography,
  Row,
  Col,
  Divider,
  Progress,
  Space,
  message,
  Modal,
  Input,
  Select,
  Tabs,
} from 'antd'
import {
  EditOutlined,
  ProjectOutlined,
  FileTextOutlined,
  TeamOutlined,
  BarChartOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { projectApi, estimateApi } from '@/api'
import PageHeader from '@/components/common/PageHeader'

const { Title, Text } = Typography

// 项目状态配置
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ongoing: { label: '进行中', color: 'processing' },
  completed: { label: '已完成', color: 'success' },
  paused: { label: '已暂停', color: 'warning' },
  cancelled: { label: '已取消', color: 'error' },
}

// 项目类型配置
const PROJECT_TYPES: Record<string, string> = {
  implementation: '实施项目',
  maintenance: '运维项目',
  consulting: '咨询项目',
  development: '开发项目',
  software: '软件项目',
}

interface ProjectDetail {
  id: number
  projectName: string
  projectType: string | null
  contractAmount: number | null
  status: string
  createdAt: string
  updatedAt: string
  documents: Array<{
    id: number
    docName: string
    docType: string
    parseStatus: string
    createdAt: string
  }>
  members: Array<{
    id: number
    name: string
    level: string
    dailyCost: number
    role: string | null
    entryTime: string | null
    leaveTime: string | null
    reportedHours: number | null
  }>
  estimateConfigs: Array<{
    id: number
    complexityConfig: string | null
    managementCoefficient: number
    createdAt: string
  }>
  estimateResults: Array<{
    id: number
    totalManDay: number
    totalCost: number
    moduleCount: number
    manMonth: number
    stageDetail: string | null
    teamDetail: string | null
    createdAt: string
  }>
  costs: Array<{
    id: number
    contractAmount: number
    availableCost: number
    dailyManpowerCost: number
    availableDays: number
    burnoutDate: string | null
    updatedAt: string
  }>
  deviations: Array<{
    id: number
    costDeviation: number
    taskProgress: number
    currentCostConsumption: number
    aiSuggestion: string | null
    updatedAt: string
  }>
}

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editProjectName, setEditProjectName] = useState('')
  const [editProjectType, setEditProjectType] = useState('')
  const [editProjectStatus, setEditProjectStatus] = useState('')
  const [updating, setUpdating] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (projectId) {
      fetchProjectDetail()
    }
  }, [projectId])

  const fetchProjectDetail = async () => {
    setLoading(true)
    try {
      const response = await projectApi.getDetail(Number(projectId))
      if (response.data.code === 0 || response.data.code === 200) {
        setProject(response.data.data)
      }
    } catch {
      message.error('获取项目详情失败')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateProject = async () => {
    if (!editProjectName.trim()) {
      message.warning('请输入项目名称')
      return
    }

    setUpdating(true)
    try {
      await projectApi.update(Number(projectId), {
        projectName: editProjectName.trim(),
        projectType: editProjectType,
        status: editProjectStatus,
      })
      message.success('项目更新成功')
      setEditModalVisible(false)
      fetchProjectDetail()
    } catch {
      // Error handled by interceptor
    } finally {
      setUpdating(false)
    }
  }

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
      link.download = `成本预估报告_${project?.projectName}_${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      message.success('报告导出成功')
    } catch {
      message.error('报告导出失败')
    } finally {
      setExporting(false)
    }
  }

  const openEditModal = () => {
    if (project) {
      setEditProjectName(project.projectName)
      setEditProjectType(project.projectType || '')
      setEditProjectStatus(project.status)
      setEditModalVisible(true)
    }
  }

  // 团队成员表格列配置
  const memberColumns: ColumnsType<any> = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      render: (level: string) => <Tag color="blue">{level}</Tag>,
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string | null) => role || '-',
    },
    {
      title: '日成本(万元)',
      dataIndex: 'dailyCost',
      key: 'dailyCost',
      render: (cost: number) => cost.toFixed(2),
    },
    {
      title: '入场时间',
      dataIndex: 'entryTime',
      key: 'entryTime',
      render: (time: string | null) => time ? new Date(time).toLocaleDateString('zh-CN') : '-',
    },
  ]

  // 评估结果表格列配置
  const estimateColumns: ColumnsType<any> = [
    {
      title: '计算时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '总人天',
      dataIndex: 'totalManDay',
      key: 'totalManDay',
      render: (value: number) => <Text strong style={{ color: '#3B82F6' }}>{value.toFixed(1)}</Text>,
    },
    {
      title: '人月',
      dataIndex: 'manMonth',
      key: 'manMonth',
      render: (value: number) => value.toFixed(2),
    },
    {
      title: '总成本(元)',
      dataIndex: 'totalCost',
      key: 'totalCost',
      render: (value: number) => <Text strong style={{ color: '#EF4444' }}>{value.toFixed(2)}</Text>,
    },
    {
      title: '模块数',
      dataIndex: 'moduleCount',
      key: 'moduleCount',
    },
  ]

  // 阶段明细表格列
  const stageColumns: ColumnsType<any> = [
    {
      title: '阶段',
      dataIndex: 'stage',
      key: 'stage',
    },
    {
      title: '人天',
      dataIndex: 'manDays',
      key: 'manDays',
      render: (value: number) => value.toFixed(1),
    },
    {
      title: '占比',
      dataIndex: 'percentage',
      key: 'percentage',
      render: (value: number) => (
        <Progress
          percent={value}
          size="small"
          strokeColor="#3B82F6"
          format={(percent) => `${percent?.toFixed(1)}%`}
        />
      ),
    },
  ]

  const breadcrumbItems = [
    { title: '首页', href: '/dashboard' },
    { title: '项目管理' },
    { title: '我的项目', href: '/project/list' },
    { title: project?.projectName || '项目详情' },
  ]

  if (loading) {
    return (
      <div className="page-container">
        <Card style={{ borderRadius: 16 }}>
          <Spin size="large" tip="加载项目详情..." />
        </Card>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="page-container">
        <Card style={{ borderRadius: 16, textAlign: 'center', padding: 48 }}>
          <Empty description="项目不存在或无权访问">
            <Button type="primary" onClick={() => navigate('/project/list')}>
              返回项目列表
            </Button>
          </Empty>
        </Card>
      </div>
    )
  }

  // 解析最新的评估结果
  const latestResult = project.estimateResults[0]
  let stageDetail: any[] = []
  let teamDetail: any[] = []
  if (latestResult) {
    try {
      stageDetail = latestResult.stageDetail ? JSON.parse(latestResult.stageDetail) : []
      teamDetail = latestResult.teamDetail ? JSON.parse(latestResult.teamDetail) : []
    } catch (e) {
      // ignore
    }
  }

  return (
    <div className="page-container">
      <PageHeader
        title={project.projectName}
        breadcrumb={breadcrumbItems}
        extra={
          <Space>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExportExcel}
              loading={exporting}
              disabled={!latestResult}
            >
              导出评估报告
            </Button>
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={openEditModal}
            >
              编辑项目
            </Button>
          </Space>
        }
      />

      {/* 项目基本信息 */}
      <Card
        title={
          <Space>
            <ProjectOutlined style={{ color: '#3B82F6' }} />
            <span>项目基本信息</span>
          </Space>
        }
        style={{ marginBottom: 24, borderRadius: 16 }}
      >
        <Descriptions column={4} labelStyle={{ fontWeight: 600 }}>
          <Descriptions.Item label="项目名称">{project.projectName}</Descriptions.Item>
          <Descriptions.Item label="项目类型">
            {PROJECT_TYPES[project.projectType || ''] || project.projectType || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="项目状态">
            <Tag color={STATUS_CONFIG[project.status]?.color || 'default'}>
              {STATUS_CONFIG[project.status]?.label || project.status}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="合同金额">
            {project.contractAmount ? `¥ ${project.contractAmount.toFixed(2)} 元` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            <CalendarOutlined style={{ marginRight: 8, color: '#64748b' }} />
            {new Date(project.createdAt).toLocaleString('zh-CN')}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            <ClockCircleOutlined style={{ marginRight: 8, color: '#64748b' }} />
            {new Date(project.updatedAt).toLocaleString('zh-CN')}
          </Descriptions.Item>
          <Descriptions.Item label="文档数量">
            <FileTextOutlined style={{ marginRight: 8, color: '#64748b' }} />
            {project.documents.length} 个
          </Descriptions.Item>
          <Descriptions.Item label="团队成员">
            <TeamOutlined style={{ marginRight: 8, color: '#64748b' }} />
            {project.members.length} 人
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 评估结果概览 */}
      {latestResult && (
        <Card
          title={
            <Space>
              <BarChartOutlined style={{ color: '#8B5CF6' }} />
              <span>成本评估结果</span>
            </Space>
          }
          style={{ marginBottom: 24, borderRadius: 16 }}
        >
          <Row gutter={24}>
            <Col span={6}>
              <Card
                size="small"
                style={{ background: '#EFF6FF', borderRadius: 12, textAlign: 'center' }}
                bordered={false}
              >
                <Text type="secondary" style={{ fontSize: 12 }}>总人天</Text>
                <Title level={3} style={{ color: '#3B82F6', margin: '8px 0 0' }}>
                  {latestResult.totalManDay.toFixed(1)}
                </Title>
                <Text type="secondary" style={{ fontSize: 12 }}>人天</Text>
              </Card>
            </Col>
            <Col span={6}>
              <Card
                size="small"
                style={{ background: '#F0FDF4', borderRadius: 12, textAlign: 'center' }}
                bordered={false}
              >
                <Text type="secondary" style={{ fontSize: 12 }}>人月</Text>
                <Title level={3} style={{ color: '#10B981', margin: '8px 0 0' }}>
                  {latestResult.manMonth.toFixed(2)}
                </Title>
                <Text type="secondary" style={{ fontSize: 12 }}>人月</Text>
              </Card>
            </Col>
            <Col span={6}>
              <Card
                size="small"
                style={{ background: '#FEF2F2', borderRadius: 12, textAlign: 'center' }}
                bordered={false}
              >
                <Text type="secondary" style={{ fontSize: 12 }}>总成本</Text>
                <Title level={3} style={{ color: '#EF4444', margin: '8px 0 0' }}>
                  {latestResult.totalCost.toFixed(2)}
                </Title>
                <Text type="secondary" style={{ fontSize: 12 }}>元</Text>
              </Card>
            </Col>
            <Col span={6}>
              <Card
                size="small"
                style={{ background: '#FAF5FF', borderRadius: 12, textAlign: 'center' }}
                bordered={false}
              >
                <Text type="secondary" style={{ fontSize: 12 }}>功能模块</Text>
                <Title level={3} style={{ color: '#8B5CF6', margin: '8px 0 0' }}>
                  {latestResult.moduleCount}
                </Title>
                <Text type="secondary" style={{ fontSize: 12 }}>个</Text>
              </Card>
            </Col>
          </Row>

          <Divider />

          <Tabs
            items={[
              {
                key: 'stages',
                label: '阶段明细',
                children: (
                  <Table
                    columns={stageColumns}
                    dataSource={stageDetail}
                    rowKey="stage"
                    pagination={false}
                    size="small"
                  />
                ),
              },
              {
                key: 'teams',
                label: '团队成本',
                children: (
                  <Table
                    columns={[
                      { title: '团队', dataIndex: 'level', key: 'level' },
                      {
                        title: '人天',
                        dataIndex: 'manDays',
                        key: 'manDays',
                        render: (v: number) => v?.toFixed(1) || '-',
                      },
                      {
                        title: '成本(元)',
                        dataIndex: 'totalCost',
                        key: 'totalCost',
                        render: (v: number) => v?.toFixed(2) || '-',
                      },
                    ]}
                    dataSource={teamDetail}
                    rowKey="level"
                    pagination={false}
                    size="small"
                  />
                ),
              },
              {
                key: 'history',
                label: '计算历史',
                children: (
                  <Table
                    columns={estimateColumns}
                    dataSource={project.estimateResults}
                    rowKey="id"
                    pagination={false}
                    size="small"
                  />
                ),
              },
            ]}
          />
        </Card>
      )}

      {/* 团队成员 */}
      <Card
        title={
          <Space>
            <TeamOutlined style={{ color: '#F59E0B' }} />
            <span>团队成员</span>
          </Space>
        }
        style={{ marginBottom: 24, borderRadius: 16 }}
      >
        {project.members.length > 0 ? (
          <Table
            columns={memberColumns}
            dataSource={project.members}
            rowKey="id"
            pagination={false}
          />
        ) : (
          <Empty description="暂无团队成员" />
        )}
      </Card>

      {/* 项目文档 */}
      <Card
        title={
          <Space>
            <FileTextOutlined style={{ color: '#64748b' }} />
            <span>项目文档</span>
          </Space>
        }
        style={{ borderRadius: 16 }}
      >
        {project.documents.length > 0 ? (
          <Table
            columns={[
              {
                title: '文档名称',
                dataIndex: 'docName',
                key: 'docName',
              },
              {
                title: '文档类型',
                dataIndex: 'docType',
                key: 'docType',
                render: (type: string) => type === 'requirement' ? '需求文档' : type,
              },
              {
                title: '解析状态',
                dataIndex: 'parseStatus',
                key: 'parseStatus',
                render: (status: string) => {
                  const statusMap: Record<string, { label: string; color: string }> = {
                    pending: { label: '待解析', color: 'default' },
                    parsing: { label: '解析中', color: 'processing' },
                    success: { label: '解析成功', color: 'success' },
                    failed: { label: '解析失败', color: 'error' },
                  }
                  const config = statusMap[status] || { label: status, color: 'default' }
                  return <Tag color={config.color}>{config.label}</Tag>
                },
              },
              {
                title: '上传时间',
                dataIndex: 'createdAt',
                key: 'createdAt',
                render: (date: string) => new Date(date).toLocaleString('zh-CN'),
              },
            ]}
            dataSource={project.documents}
            rowKey="id"
            pagination={false}
          />
        ) : (
          <Empty description="暂无项目文档" />
        )}
      </Card>

      {/* 编辑项目弹窗 */}
      <Modal
        title="编辑项目"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleUpdateProject}
        confirmLoading={updating}
        okText="保存"
        cancelText="取消"
        width={480}
      >
        <div style={{ paddingTop: 16 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              项目名称
            </label>
            <Input
              placeholder="请输入项目名称"
              value={editProjectName}
              onChange={(e) => setEditProjectName(e.target.value)}
              maxLength={100}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              项目类型
            </label>
            <Select
              placeholder="请选择项目类型"
              value={editProjectType}
              onChange={setEditProjectType}
              options={[
                { value: 'implementation', label: '实施项目' },
                { value: 'maintenance', label: '运维项目' },
                { value: 'consulting', label: '咨询项目' },
                { value: 'development', label: '开发项目' },
              ]}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              项目状态
            </label>
            <Select
              placeholder="请选择项目状态"
              value={editProjectStatus}
              onChange={setEditProjectStatus}
              options={[
                { value: 'ongoing', label: '进行中' },
                { value: 'completed', label: '已完成' },
                { value: 'paused', label: '已暂停' },
                { value: 'cancelled', label: '已取消' },
              ]}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}