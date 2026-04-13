import { useState, useEffect } from 'react'
import {
  Card,
  Typography,
  Table,
  Button,
  Tag,
  Space,
  Input,
  Select,
  DatePicker,
  message,
  Modal,
  Form,
  InputNumber,
  Spin,
} from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { projectApi } from '@/api'
import { MEMBER_LEVEL_DAILY_COST } from '@/types'
import type { MemberLevel } from '@/types'

const { Text } = Typography

// 成员等级选项
const levelOptions: { value: MemberLevel; label: string }[] = [
  { value: 'P5', label: 'P5' },
  { value: 'P6', label: 'P6' },
  { value: 'P7', label: 'P7' },
  { value: 'P8', label: 'P8' },
]

// 成员数据接口
interface MemberData {
  key: string
  memberId: number
  projectId: number
  projectName: string
  name: string
  department: string
  level: MemberLevel
  role: string
  reportedHours: number
  dailyCost: number
  entryTime: string | null
  leaveTime: string | null
  isToEnd: boolean
}

export default function CostDeviationMemberList() {
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<MemberData[]>([])
  const [searchText, setSearchText] = useState('')
  const [filterLevel, setFilterLevel] = useState<string | null>(null)

  // 模态框状态
  const [modalVisible, setModalVisible] = useState(false)
  const [editingMember, setEditingMember] = useState<MemberData | null>(null)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  // 加载所有项目的人员信息
  useEffect(() => {
    loadMembers()
  }, [])

  const loadMembers = async () => {
    setLoading(true)
    try {
      const response = await projectApi.getList({ pageSize: 100 })
      if (response.data.code === 0 || response.data.code === 200) {
        const projects = response.data.data || []
        // 提取所有项目成员
        const allMembers: MemberData[] = []
        let keyIndex = 0
        for (const project of projects) {
          if (project.members && project.members.length > 0) {
            for (const member of project.members) {
              allMembers.push({
                key: `member_${keyIndex++}`,
                memberId: member.id,
                projectId: project.id,
                projectName: project.projectName,
                name: member.name || '',
                department: member.department || '',
                level: member.level as MemberLevel,
                role: member.role || '',
                reportedHours: member.reportedHours || 0,
                dailyCost: member.dailyCost || 0,
                entryTime: member.entryTime || null,
                leaveTime: member.leaveTime || null,
                isToEnd: member.isToEnd || false,
              })
            }
          }
        }
        setMembers(allMembers)
      }
    } catch {
      message.error('加载人员信息失败')
    } finally {
      setLoading(false)
    }
  }

  // 过滤后的数据
  const filteredMembers = members.filter((m) => {
    const matchSearch = !searchText ||
      m.name.includes(searchText) ||
      m.projectName.includes(searchText) ||
      m.department.includes(searchText)
    const matchLevel = !filterLevel || m.level === filterLevel
    return matchSearch && matchLevel
  })

  // 打开编辑模态框
  const handleEdit = (member: MemberData) => {
    setEditingMember(member)
    form.setFieldsValue({
      name: member.name,
      department: member.department,
      level: member.level,
      role: member.role,
      reportedHours: member.reportedHours,
      entryTime: member.entryTime ? dayjs(member.entryTime) : null,
      leaveTime: member.leaveTime ? dayjs(member.leaveTime) : null,
      isToEnd: member.isToEnd,
    })
    setModalVisible(true)
  }

  // 保存成员信息
  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)

      // TODO: 调用API保存成员信息
      // 目前为本地模拟
      if (editingMember) {
        // 更新
        setMembers(prev => prev.map(m =>
          m.key === editingMember.key
            ? {
                ...m,
                name: values.name,
                department: values.department,
                level: values.level,
                role: values.role,
                reportedHours: values.reportedHours,
                dailyCost: MEMBER_LEVEL_DAILY_COST[values.level as MemberLevel],
                entryTime: values.entryTime?.format('YYYY-MM-DD') || null,
                leaveTime: values.isToEnd ? '2099-12-31' : values.leaveTime?.format('YYYY-MM-DD') || null,
                isToEnd: values.isToEnd,
              }
            : m
        ))
        message.success('更新成功')
      } else {
        // 新增
        message.info('请先在项目详情页面添加成员')
      }

      setModalVisible(false)
    } catch {
      // 表单验证失败
    } finally {
      setSaving(false)
    }
  }

  // 删除成员
  const handleDelete = (member: MemberData) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除成员"${member.name}"吗？`,
      onOk: () => {
        setMembers(prev => prev.filter(m => m.key !== member.key))
        message.success('删除成功')
      },
    })
  }

  // 表格列配置
  const columns: ColumnsType<MemberData> = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 100,
      fixed: 'left',
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: '所属项目',
      dataIndex: 'projectName',
      key: 'projectName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
      width: 100,
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 80,
      render: (v: MemberLevel) => (
        <Tag style={{ borderRadius: 8, background: '#3B82F615', color: '#3B82F6', border: 'none' }}>
          {v}
        </Tag>
      ),
    },
    {
      title: '岗位/角色',
      dataIndex: 'role',
      key: 'role',
      width: 100,
    },
    {
      title: '已报工时',
      dataIndex: 'reportedHours',
      key: 'reportedHours',
      width: 100,
      render: (v: number) => `${v || 0} 小时`,
    },
    {
      title: '日成本(万元)',
      dataIndex: 'dailyCost',
      key: 'dailyCost',
      width: 100,
      render: (v: number) => v?.toFixed(2) || '-',
    },
    {
      title: '入项时间',
      dataIndex: 'entryTime',
      key: 'entryTime',
      width: 110,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD') : '-',
    },
    {
      title: '离项时间',
      dataIndex: 'leaveTime',
      key: 'leaveTime',
      width: 110,
      render: (v: string, r: MemberData) =>
        r.isToEnd ? <Tag color="blue">至结项</Tag> : (v ? dayjs(v).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            style={{ color: '#3B82F6' }}
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          />
        </Space>
      ),
    },
  ]

  if (loading) {
    return (
      <div className="page-container">
        <Card style={{ borderRadius: 16, textAlign: 'center', padding: 48 }}>
          <Spin size="large" tip="加载人员信息..." />
        </Card>
      </div>
    )
  }

  return (
    <div className="page-container">
      {/* 搜索和筛选 */}
      <Card
        style={{
          borderRadius: 20,
          marginBottom: 24,
          border: '1px solid #f1f5f9',
        }}
      >
        <Space size="middle" wrap>
          <Input
            placeholder="搜索姓名/项目/部门"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 220, borderRadius: 10 }}
            allowClear
          />
          <Select
            placeholder="筛选级别"
            value={filterLevel}
            onChange={setFilterLevel}
            options={levelOptions}
            style={{ width: 120 }}
            allowClear
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={loadMembers}
            style={{ borderRadius: 10 }}
          >
            刷新
          </Button>
          <Text type="secondary">
            共 {filteredMembers.length} 人
          </Text>
        </Space>
      </Card>

      {/* 人员列表 */}
      <Card
        style={{
          borderRadius: 20,
          border: '1px solid #f1f5f9',
        }}
      >
        <Table
          columns={columns}
          dataSource={filteredMembers}
          rowKey="key"
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          locale={{ emptyText: '暂无人员信息' }}
        />
      </Card>

      {/* 编辑/新增模态框 */}
      <Modal
        title={editingMember ? '编辑成员' : '新增成员'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        confirmLoading={saving}
        width={600}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" maxLength={10} />
          </Form.Item>
          <Form.Item name="department" label="部门">
            <Input placeholder="请输入部门" />
          </Form.Item>
          <Form.Item
            name="level"
            label="级别"
            rules={[{ required: true, message: '请选择级别' }]}
          >
            <Select options={levelOptions} placeholder="请选择级别" />
          </Form.Item>
          <Form.Item name="role" label="岗位/角色">
            <Input placeholder="请输入岗位或角色" />
          </Form.Item>
          <Form.Item name="reportedHours" label="已报工时(小时)">
            <InputNumber min={0} precision={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="entryTime" label="入项时间">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="leaveTime" label="离项时间">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}