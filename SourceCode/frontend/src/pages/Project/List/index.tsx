import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card,
  Table,
  Button,
  Input,
  Select,
  Space,
  Modal,
  Tag,
  Popconfirm,
  Pagination,
  Spin,
  Empty,
  message,
} from 'antd'
import {
  SearchOutlined,
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  ProjectOutlined,
} from '@ant-design/icons'
import { projectApi } from '@/api'
import type { Project, ProjectStatus } from '@/types'
import type { ColumnsType } from 'antd/es/table'
import PageHeader from '@/components/common/PageHeader'

// 项目状态配置
const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string }> = {
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
}

interface ProjectListResponse {
  list: Project[]
  total: number
  page: number
  pageSize: number
}

export default function ProjectList() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // 搜索参数
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchStatus, setSearchStatus] = useState<string | undefined>(undefined)

  // 新建项目弹窗
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectType, setNewProjectType] = useState('')
  const [creating, setCreating] = useState(false)

  // 编辑项目弹窗
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [editProjectName, setEditProjectName] = useState('')
  const [editProjectType, setEditProjectType] = useState('')
  const [editProjectStatus, setEditProjectStatus] = useState<ProjectStatus>('ongoing')
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    fetchProjects()
  }, [currentPage, pageSize, searchKeyword, searchStatus])

  const fetchProjects = async () => {
    setLoading(true)
    try {
      const response = await projectApi.getList({
        keyword: searchKeyword,
        status: searchStatus,
        page: currentPage,
        pageSize: pageSize,
      })
      const data = response.data.data as ProjectListResponse
      setProjects(data.list)
      setTotal(data.total)
    } catch {
      // Error handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setSearchKeyword(keyword)
    setSearchStatus(statusFilter)
    setCurrentPage(1)
  }

  const handleReset = () => {
    setKeyword('')
    setStatusFilter(undefined)
    setSearchKeyword('')
    setSearchStatus(undefined)
    setCurrentPage(1)
  }

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      message.warning('请输入项目名称')
      return
    }
    if (!newProjectType) {
      message.warning('请选择项目类型')
      return
    }

    setCreating(true)
    try {
      await projectApi.create({
        projectName: newProjectName.trim(),
        projectType: newProjectType,
        status: 'ongoing',
      })
      message.success('项目创建成功')
      setCreateModalVisible(false)
      setNewProjectName('')
      setNewProjectType('')
      fetchProjects()
    } catch {
      // Error handled by interceptor
    } finally {
      setCreating(false)
    }
  }

  const handleEditProject = async () => {
    if (!editingProject) return
    if (!editProjectName.trim()) {
      message.warning('请输入项目名称')
      return
    }

    setUpdating(true)
    try {
      await projectApi.update(editingProject.projectId, {
        projectName: editProjectName.trim(),
        projectType: editProjectType,
        status: editProjectStatus,
      })
      message.success('项目更新成功')
      setEditModalVisible(false)
      setEditingProject(null)
      fetchProjects()
    } catch {
      // Error handled by interceptor
    } finally {
      setUpdating(false)
    }
  }

  const handleDeleteProject = async (projectId: number) => {
    try {
      await projectApi.delete(projectId)
      message.success('项目删除成功')
      fetchProjects()
    } catch {
      // Error handled by interceptor
    }
  }

  const openEditModal = (project: Project) => {
    setEditingProject(project)
    setEditProjectName(project.projectName)
    setEditProjectType(project.projectType || '')
    setEditProjectStatus(project.status)
    setEditModalVisible(true)
  }

  const columns: ColumnsType<Project> = [
    {
      title: '项目名称',
      dataIndex: 'projectName',
      key: 'projectName',
      ellipsis: true,
      render: (text: string, record: Project) => (
        <a
          onClick={() => navigate(`/project/detail/${record.projectId}`)}
          style={{ color: '#1890ff' }}
        >
          {text}
        </a>
      ),
    },
    {
      title: '项目类型',
      dataIndex: 'projectType',
      key: 'projectType',
      width: 120,
      render: (type: string) => PROJECT_TYPES[type] || type || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: ProjectStatus) => (
        <Tag color={STATUS_CONFIG[status]?.color || 'default'}>
          {STATUS_CONFIG[status]?.label || status}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record: Project) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/project/detail/${record.projectId}`)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description="删除后无法恢复，确定要删除此项目吗？"
            onConfirm={() => handleDeleteProject(record.projectId)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const breadcrumbItems = [
    { title: '首页', href: '/dashboard' },
    { title: '项目管理' },
    { title: '我的项目' },
  ]

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title="我的项目"
        breadcrumb={breadcrumbItems}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            新建项目
          </Button>
        }
      />

      <Card style={{ marginBottom: 16 }}>
        <Space wrap size="middle">
          <Input
            placeholder="搜索项目名称"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 200 }}
            allowClear
          />
          <Select
            placeholder="选择状态"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'ongoing', label: '进行中' },
              { value: 'completed', label: '已完成' },
              { value: 'paused', label: '已暂停' },
              { value: 'cancelled', label: '已取消' },
            ]}
            style={{ width: 120 }}
            allowClear
          />
          <Button type="primary" onClick={handleSearch}>
            搜索
          </Button>
          <Button onClick={handleReset}>
            重置
          </Button>
        </Space>
      </Card>

      <Card>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
            <Spin size="large" tip="加载中..." />
          </div>
        ) : projects.length === 0 ? (
          <Empty
            description="暂无项目数据"
            style={{ margin: '50px 0' }}
          >
            <Button
              type="primary"
              icon={<ProjectOutlined />}
              onClick={() => setCreateModalVisible(true)}
            >
              创建第一个项目
            </Button>
          </Empty>
        ) : (
          <>
            <Table
              columns={columns}
              dataSource={projects}
              rowKey="projectId"
              pagination={false}
              scroll={{ x: 800 }}
            />
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={total}
                showSizeChanger
                showQuickJumper
                showTotal={(total) => `共 ${total} 条`}
                onChange={(page, size) => {
                  setCurrentPage(page)
                  setPageSize(size)
                }}
                pageSizeOptions={['10', '20', '50', '100']}
              />
            </div>
          </>
        )}
      </Card>

      {/* 新建项目弹窗 */}
      <Modal
        title="新建项目"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false)
          setNewProjectName('')
          setNewProjectType('')
        }}
        onOk={handleCreateProject}
        confirmLoading={creating}
        okText="创建"
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
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              maxLength={100}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              项目类型
            </label>
            <Select
              placeholder="请选择项目类型"
              value={newProjectType}
              onChange={setNewProjectType}
              options={[
                { value: 'implementation', label: '实施项目' },
                { value: 'maintenance', label: '运维项目' },
                { value: 'consulting', label: '咨询项目' },
                { value: 'development', label: '开发项目' },
              ]}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </Modal>

      {/* 编辑项目弹窗 */}
      <Modal
        title="编辑项目"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false)
          setEditingProject(null)
        }}
        onOk={handleEditProject}
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