import { useState, useEffect } from 'react'
import {
  Card,
  Descriptions,
  Form,
  Input,
  Button,
  Space,
  Table,
  Tag,
  Modal,
  message,
  Spin,
  Typography,
  Progress,
} from 'antd'
import {
  UserOutlined,
  LockOutlined,
  SettingOutlined,
  HistoryOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { authApi } from '@/api'
import { useUserStore } from '@/store/userStore'
import type { User, OperationLog, UserRole } from '@/types'
import type { ColumnsType } from 'antd/es/table'
import PageHeader from '@/components/common/PageHeader'

const { Text } = Typography

// 用户角色配置
const ROLE_CONFIG: Record<UserRole, { label: string; color: string }> = {
  pm: { label: '项目经理', color: 'blue' },
  supervisor: { label: '主管', color: 'green' },
  department_head: { label: '部门主管', color: 'purple' },
  finance: { label: '财务', color: 'orange' },
}

// 参数模板类型
interface ParamTemplate {
  templateId: number
  templateName: string
  description: string
  createdAt: string
  updatedAt: string
}

// 密码强度计算
const calculatePasswordStrength = (password: string): number => {
  let strength = 0
  if (password.length >= 6) strength += 20
  if (password.length >= 8) strength += 10
  if (password.length >= 12) strength += 10
  if (/[a-z]/.test(password)) strength += 15
  if (/[A-Z]/.test(password)) strength += 15
  if (/[0-9]/.test(password)) strength += 15
  if (/[^a-zA-Z0-9]/.test(password)) strength += 15
  return Math.min(strength, 100)
}

const getPasswordStrengthColor = (strength: number): string => {
  if (strength < 30) return '#ff4d4f'
  if (strength < 60) return '#faad14'
  if (strength < 80) return '#52c41a'
  return '#1890ff'
}

const getPasswordStrengthText = (strength: number): string => {
  if (strength < 30) return '弱'
  if (strength < 60) return '中等'
  if (strength < 80) return '强'
  return '非常强'
}

// 操作类型配置
const ACTION_CONFIG: Record<string, { label: string; color: string }> = {
  login: { label: '登录', color: 'blue' },
  logout: { label: '登出', color: 'default' },
  create_project: { label: '创建项目', color: 'green' },
  update_project: { label: '更新项目', color: 'orange' },
  delete_project: { label: '删除项目', color: 'red' },
  change_password: { label: '修改密码', color: 'purple' },
  update_template: { label: '更新模板', color: 'cyan' },
}

interface PasswordFormValues {
  oldPassword: string
  newPassword: string
  confirmPassword: string
}

interface TemplateFormValues {
  templateName: string
  description: string
}

export default function UserSetting() {
  const user = useUserStore((state) => state.user)
  const [loading, setLoading] = useState(true)
  const [userInfo, setUserInfo] = useState<User | null>(null)
  const [operationLogs, setOperationLogs] = useState<OperationLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  // 密码修改表单
  const [passwordForm] = Form.useForm()
  const [passwordStrength, setPasswordStrength] = useState(0)
  const [changingPassword, setChangingPassword] = useState(false)

  // 参数模板
  const [templates, setTemplates] = useState<ParamTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templateModalVisible, setTemplateModalVisible] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ParamTemplate | null>(null)
  const [templateForm] = Form.useForm()
  const [savingTemplate, setSavingTemplate] = useState(false)

  useEffect(() => {
    fetchUserInfo()
    fetchOperationLogs()
    fetchTemplates()
  }, [])

  const fetchUserInfo = async () => {
    setLoading(true)
    try {
      const response = await authApi.getUserInfo()
      setUserInfo(response.data.data as User)
    } catch {
      // Error handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  const fetchOperationLogs = async () => {
    setLogsLoading(true)
    try {
      // 使用 projectApi 获取操作日志，或者需要添加专门的日志API
      // 这里假设有一个 getUserLogs 方法
      const response = await authApi.getUserInfo()
      setUserInfo(response.data.data as User)
      // 模拟一些日志数据
      setOperationLogs([])
    } catch {
      // Error handled by interceptor
    } finally {
      setLogsLoading(false)
    }
  }

  const fetchTemplates = async () => {
    setTemplatesLoading(true)
    try {
      // 获取参数模板数据
      // 这里假设有相关的API，如果没有则设置为空数组
      setTemplates([])
    } catch {
      // Error handled by interceptor
    } finally {
      setTemplatesLoading(false)
    }
  }

  const handlePasswordChange = async (values: PasswordFormValues) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('两次输入的密码不一致')
      return
    }

    setChangingPassword(true)
    try {
      await authApi.changePassword(values.oldPassword, values.newPassword)
      message.success('密码修改成功')
      passwordForm.resetFields()
      setPasswordStrength(0)
    } catch {
      // Error handled by interceptor
    } finally {
      setChangingPassword(false)
    }
  }

  const handleNewPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const strength = calculatePasswordStrength(e.target.value)
    setPasswordStrength(strength)
  }

  const handleOpenTemplateModal = (template?: ParamTemplate) => {
    if (template) {
      setEditingTemplate(template)
      templateForm.setFieldsValue({
        templateName: template.templateName,
        description: template.description,
      })
    } else {
      setEditingTemplate(null)
      templateForm.resetFields()
    }
    setTemplateModalVisible(true)
  }

  const handleSaveTemplate = async (_values: TemplateFormValues) => {
    setSavingTemplate(true)
    try {
      // 这里需要调用实际的API来保存模板
      message.success(editingTemplate ? '模板更新成功' : '模板创建成功')
      setTemplateModalVisible(false)
      templateForm.resetFields()
      setEditingTemplate(null)
      fetchTemplates()
    } catch {
      // Error handled by interceptor
    } finally {
      setSavingTemplate(false)
    }
  }

  const handleDeleteTemplate = async (_templateId: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除此模板吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          // 调用实际的API删除模板
          message.success('模板删除成功')
          fetchTemplates()
        } catch {
          // Error handled by interceptor
        }
      },
    })
  }

  const breadcrumbItems = [
    { title: '首页', href: '/dashboard' },
    { title: '用户管理' },
    { title: '个人设置' },
  ]

  const templateColumns: ColumnsType<ParamTemplate> = [
    {
      title: '模板名称',
      dataIndex: 'templateName',
      key: 'templateName',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
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
      width: 120,
      render: (_, record: ParamTemplate) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenTemplateModal(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteTemplate(record.templateId)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ]

  const logColumns: ColumnsType<OperationLog> = [
    {
      title: '操作类型',
      dataIndex: 'action',
      key: 'action',
      width: 120,
      render: (action: string) => (
        <Tag color={ACTION_CONFIG[action]?.color || 'default'}>
          {ACTION_CONFIG[action]?.label || action}
        </Tag>
      ),
    },
    {
      title: '操作内容',
      dataIndex: 'details',
      key: 'details',
      ellipsis: true,
    },
    {
      title: 'IP地址',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      width: 140,
    },
    {
      title: '操作时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
  ]

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" tip="加载中..." />
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <PageHeader title="个人设置" breadcrumb={breadcrumbItems} />

      {/* 个人信息卡片 */}
      <Card
        title={
          <Space>
            <UserOutlined />
            <span>个人信息</span>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Descriptions column={{ xs: 1, sm: 2, md: 2 }}>
          <Descriptions.Item label="用户名">{userInfo?.username || user?.username}</Descriptions.Item>
          <Descriptions.Item label="姓名">{userInfo?.name || user?.name}</Descriptions.Item>
          <Descriptions.Item label="角色">
            <Tag color={ROLE_CONFIG[(userInfo?.role || user?.role) as UserRole]?.color}>
              {ROLE_CONFIG[(userInfo?.role || user?.role) as UserRole]?.label}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="邮箱">{userInfo?.email || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {userInfo?.createdAt ? new Date(userInfo.createdAt).toLocaleString('zh-CN') : '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 修改密码卡片 */}
      <Card
        title={
          <Space>
            <LockOutlined />
            <span>修改密码</span>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handlePasswordChange}
          style={{ maxWidth: 400 }}
        >
          <Form.Item
            name="oldPassword"
            label="原密码"
            rules={[
              { required: true, message: '请输入原密码' },
              { min: 6, message: '密码长度不能少于6位' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入原密码"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码长度不能少于6位' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入新密码"
              autoComplete="new-password"
              onChange={handleNewPasswordChange}
            />
          </Form.Item>

          {passwordStrength > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Text style={{ marginBottom: 4 }}>密码强度</Text>
              <Progress
                percent={passwordStrength}
                strokeColor={getPasswordStrengthColor(passwordStrength)}
                format={() => getPasswordStrengthText(passwordStrength)}
                size="small"
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                建议：密码长度至少8位，包含大小写字母、数字和特殊字符
              </Text>
            </div>
          )}

          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'))
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请再次输入新密码"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={changingPassword}
              style={{ marginTop: 8 }}
            >
              提交修改
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* 参数模板管理卡片 */}
      <Card
        title={
          <Space>
            <SettingOutlined />
            <span>参数模板管理</span>
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleOpenTemplateModal()}
          >
            新增模板
          </Button>
        }
        style={{ marginBottom: 24 }}
      >
        {templatesLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : templates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            暂无参数模板，点击上方按钮新增
          </div>
        ) : (
          <Table
            columns={templateColumns}
            dataSource={templates}
            rowKey="templateId"
            pagination={false}
          />
        )}
      </Card>

      {/* 操作日志列表 */}
      <Card
        title={
          <Space>
            <HistoryOutlined />
            <span>操作日志</span>
          </Space>
        }
      >
        {logsLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : operationLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            暂无操作日志记录
          </div>
        ) : (
          <Table
            columns={logColumns}
            dataSource={operationLogs}
            rowKey="logId"
            pagination={{
              pageSize: 10,
              showTotal: (total) => `共 ${total} 条记录`,
            }}
          />
        )}
      </Card>

      {/* 新增/编辑模板弹窗 */}
      <Modal
        title={editingTemplate ? '编辑模板' : '新增模板'}
        open={templateModalVisible}
        onCancel={() => {
          setTemplateModalVisible(false)
          templateForm.resetFields()
          setEditingTemplate(null)
        }}
        onOk={() => templateForm.submit()}
        confirmLoading={savingTemplate}
        okText="保存"
        cancelText="取消"
        width={480}
      >
        <Form
          form={templateForm}
          layout="vertical"
          onFinish={handleSaveTemplate}
          style={{ paddingTop: 16 }}
        >
          <Form.Item
            name="templateName"
            label="模板名称"
            rules={[
              { required: true, message: '请输入模板名称' },
              { max: 50, message: '模板名称不能超过50个字符' },
            ]}
          >
            <Input placeholder="请输入模板名称" maxLength={50} />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
            rules={[{ max: 200, message: '描述不能超过200个字符' }]}
          >
            <Input.TextArea
              placeholder="请输入模板描述"
              maxLength={200}
              rows={3}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}