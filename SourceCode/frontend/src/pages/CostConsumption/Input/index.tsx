import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Card,
  Steps,
  Upload,
  Button,
  Typography,
  message,
  Form,
  InputNumber,
  Input,
  Table,
  Select,
  DatePicker,
  Row,
  Col,
  Tag,
  Tooltip,
  Checkbox,
} from 'antd'
import {
  InboxOutlined,
  FormOutlined,
  BarChartOutlined,
  PlusOutlined,
  DeleteOutlined,
  TeamOutlined,
  DollarOutlined,
  CameraOutlined,
  ArrowRightOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  SearchOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import type { UploadProps, UploadFile } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { consumptionApi } from '@/api'
import { MEMBER_LEVEL_DAILY_COST } from '@/types'
import type { MemberLevel } from '@/types'

const { Title, Text } = Typography
const { Dragger } = Upload

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
  department?: string
  level: MemberLevel
  dailyCost: number
  entryTime: string | null
  leaveTime: string | null
  isToEnd: boolean
}

export default function CostConsumptionInput() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('projectId')

  const [currentStep, setCurrentStep] = useState(0)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrSuccess, setOcrSuccess] = useState(false)

  // 项目编号查询相关状态
  const [projectCode, setProjectCode] = useState('')
  const [querying, setQuerying] = useState(false)
  const [actualProjectId, setActualProjectId] = useState<number | null>(null)

  // OCR识别结果表单
  const [form] = Form.useForm()

  // 成员列表数据
  const [members, setMembers] = useState<MemberFormData[]>([])
  const [saving, setSaving] = useState(false)

  // 生成唯一key
  const generateKey = () => `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // 根据项目编号查询项目信息
  const handleQueryByProjectCode = async () => {
    if (!projectCode) {
      message.warning('请输入项目编号')
      return
    }

    setQuerying(true)
    try {
      const response = await consumptionApi.queryByProjectCode(projectCode)
      if (response.data.code === 0 || response.data.code === 200) {
        const data = response.data.data
        // 反显项目信息
        form.setFieldsValue({
          contractAmount: data.contractAmount || 0,
          preSaleRatio: data.preSaleRatio || 0,
          taxRate: data.taxRate || 0.06,
          externalLaborCost: data.externalLaborCost || 0,
          externalSoftwareCost: data.externalSoftwareCost || 0,
          otherCost: data.otherCost || 0,
          currentManpowerCost: data.currentManpowerCost || 0,
        })
        // 反显人员列表
        if (data.members && data.members.length > 0) {
          setMembers(data.members.map((m: any, index: number) => ({
            key: `member_${index}_${Date.now()}`,
            memberId: m.memberId,
            name: m.name || '',
            department: m.department || '',
            level: m.level || 'P5',
            dailyCost: m.dailyCost || MEMBER_LEVEL_DAILY_COST['P5'],
            entryTime: m.entryTime || null,
            leaveTime: m.leaveTime || null,
            isToEnd: m.isToEnd || false,
          })))
        }
        setActualProjectId(data.projectId)
        message.success('项目信息已加载')
      }
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || '查询项目失败'
      message.error(errorMsg)
    } finally {
      setQuerying(false)
    }
  }

  // 保存项目人员信息
  const handleSaveMembers = async () => {
    const pid = actualProjectId || projectId
    if (!pid) {
      message.warning('请先通过项目编号查询项目或上传OA截图')
      return
    }

    const validMembers = members.filter(m => m.name && m.level)
    if (validMembers.length === 0) {
      message.warning('请至少添加一名有效成员')
      return
    }

    setSaving(true)
    try {
      await consumptionApi.saveMembers(Number(pid), validMembers.map(m => ({
        name: m.name,
        department: m.department,
        level: m.level,
        dailyCost: m.dailyCost,
        entryTime: m.entryTime,
        leaveTime: m.isToEnd ? null : m.leaveTime,
        isToEnd: m.isToEnd,
      })))
      message.success('人员信息保存成功')
    } catch {
      message.error('人员信息保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 图片上传前的校验
  const beforeUpload = (file: File) => {
    const isValidType =
      file.type === 'image/jpeg' ||
      file.type === 'image/png' ||
      file.type === 'image/jpg' ||
      file.type === 'image/webp' ||
      file.name.endsWith('.jpg') ||
      file.name.endsWith('.jpeg') ||
      file.name.endsWith('.png') ||
      file.name.endsWith('.webp')

    if (!isValidType) {
      message.error('仅支持 JPG/PNG/WEBP 格式的图片')
      return Upload.LIST_IGNORE
    }

    const isValidSize = file.size / 1024 / 1024 < 10
    if (!isValidSize) {
      message.error('图片大小不能超过 10MB')
      return Upload.LIST_IGNORE
    }

    return true
  }

  // OCR识别处理
  const handleOcrRecognize = async () => {
    if (fileList.length === 0) {
      message.warning('请先上传OA截图')
      return
    }

    setOcrLoading(true)
    try {
      const files = fileList.map((f) => f.originFileObj as File).filter(Boolean)
      const response = await consumptionApi.uploadOcrImage(files)

      if (response.data.code === 0 || response.data.code === 200) {
        const ocrData = response.data.data
        // 回填OCR识别结果到表单
        form.setFieldsValue({
          contractAmount: ocrData?.contractAmount || 0,
          preSaleRatio: ocrData?.preSaleRatio || 0,
          taxRate: ocrData?.taxRate || 0,
          externalLaborCost: ocrData?.externalLaborCost || 0,
          externalSoftwareCost: ocrData?.externalSoftwareCost || 0,
          currentManpowerCost: ocrData?.currentManpowerCost || 0,
        })
        setOcrSuccess(true)
        message.success('OCR识别成功，请核对信息')
      }
    } catch {
      message.error('OCR识别失败，请重试')
    } finally {
      setOcrLoading(false)
    }
  }

  // 处理文件变化
  const handleChange: UploadProps['onChange'] = (info) => {
    setFileList(info.fileList)
    // 如果有新文件上传成功，重置OCR状态
    if (info.file.status === 'done' || info.fileList.some(f => f.status === 'done')) {
      setOcrSuccess(false)
    }
  }

  // 拖拽上传配置
  const draggerProps: UploadProps = {
    name: 'files',
    multiple: true,
    fileList,
    beforeUpload,
    onChange: handleChange,
    accept: '.jpg,.jpeg,.png,.webp',
    showUploadList: {
      showDownloadIcon: false,
      showRemoveIcon: true,
    },
    listType: 'picture-card',
  }

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
          onChange={(e) => {
            const val = e.target.value
            // 允许中文、"."、字母、数字，最多10个字符（支持少数民族姓名中的中文"."）
            if (/^[\u4e00-\u9fa5.a-zA-Z0-9]{0,10}$/.test(val) || val === '') {
              handleMemberChange(record.key, 'name', val)
            }
          }}
          placeholder="请输入姓名"
          maxLength={10}
          style={{ width: '100%', borderRadius: 8 }}
        />
      ),
    },
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
      width: 120,
      render: (value: string, record) => (
        <Input
          value={value || ''}
          onChange={(e) => handleMemberChange(record.key, 'department', e.target.value)}
          placeholder="请输入部门"
          style={{ width: '100%', borderRadius: 8 }}
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
      width: 200,
      render: (value: string | null, record) => (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Checkbox
            checked={record.isToEnd}
            onChange={(e) => handleMemberChange(record.key, 'isToEnd', e.target.checked)}
          >
            至结项
          </Checkbox>
          {!record.isToEnd && (
            <DatePicker
              value={value ? dayjs(value) : null}
              onChange={(date) =>
                handleMemberChange(record.key, 'leaveTime', date ? date.format('YYYY-MM-DD') : null)
              }
              style={{ width: 130, borderRadius: 8 }}
              placeholder="选择日期"
            />
          )}
        </div>
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
    value: string | number | boolean | null
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
      isToEnd: false,
    }
    setMembers((prev) => [...prev, newMember])
  }

  // 删除成员
  const handleDeleteMember = (key: string) => {
    setMembers((prev) => prev.filter((m) => m.key !== key))
  }

  // 开始核算
  const handleCalculate = async () => {
    try {
      // 验证表单（包含所有必填项）
      const formValues = await form.validateFields()

      // 验证合同金额大于0
      if (!formValues.contractAmount || formValues.contractAmount <= 0) {
        message.error('合同金额必须大于0')
        return
      }

      // 验证售前比例范围
      if (formValues.preSaleRatio < 0 || formValues.preSaleRatio > 1) {
        message.error('售前比例必须在0-1之间')
        return
      }

      // 验证税率范围
      if (formValues.taxRate < 0 || formValues.taxRate > 1) {
        message.error('税率必须在0-1之间')
        return
      }

      // 验证成员数据
      const validMembers = members.filter((m) => m.name && m.level)
      if (validMembers.length === 0) {
        message.warning('请至少添加一名有效成员')
        return
      }

      // 验证每个成员的姓名不能为空
      for (const member of validMembers) {
        if (!member.name || member.name.trim() === '') {
          message.error('成员姓名不能为空')
          return
        }
      }

      setSaving(true)

      // 构建提交数据
      const submitData = {
        contractAmount: formValues.contractAmount,
        preSaleRatio: formValues.preSaleRatio,
        taxRate: formValues.taxRate,
        externalLaborCost: formValues.externalLaborCost,
        externalSoftwareCost: formValues.externalSoftwareCost,
        otherCost: formValues.otherCost || 0,
        currentManpowerCost: formValues.currentManpowerCost,
        teamMembers: validMembers.map((m) => ({
          name: m.name,
          department: m.department,
          level: m.level,
          dailyCost: m.dailyCost,
          entryTime: m.entryTime,
          leaveTime: m.isToEnd ? null : m.leaveTime,
          isToEnd: m.isToEnd,
        })),
      }

      // 使用查询到的项目ID或URL中的项目ID
      const pid = actualProjectId || projectId
      if (!pid) {
        message.warning('请先通过项目编号查询项目或上传OA截图')
        setSaving(false)
        return
      }

      // 调用保存接口
      await consumptionApi.saveProjectInfo(Number(pid), submitData)

      // 调用计算接口
      const calcResponse = await consumptionApi.calculateCost(Number(pid))

      if (calcResponse.data.code === 0 || calcResponse.data.code === 200) {
        message.success('核算完成')
        setCurrentStep(1)
        navigate(`/cost-consumption/result?projectId=${pid}`)
      }
    } catch {
      message.error('核算失败，请检查数据')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-container">
      {/* 步骤条 */}
      <Card
        style={{
          borderRadius: 20,
          marginBottom: 32,
          border: '1px solid var(--color-border-light)',
        }}
      >
        <Steps current={currentStep} items={stepItems} />
      </Card>

      {/* OA截图上传区域 */}
      <Card
        style={{
          borderRadius: 24,
          marginBottom: 32,
          border: '1px solid var(--color-border-light)',
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <Title level={4} style={{ marginBottom: 8, fontWeight: 600 }}>
            <CameraOutlined style={{ marginRight: 10, color: '#10B981' }} />
            OA截图上传
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>上传OA系统截图，AI自动识别项目财务信息</Text>
        </div>

        <Dragger {...draggerProps} disabled={ocrLoading}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ color: '#10B981', fontSize: 52 }} />
          </p>
          <p className="ant-upload-text" style={{ fontSize: 16, fontWeight: 500, color: '#0f172a' }}>
            点击或拖拽图片到此区域上传
          </p>
          <p className="ant-upload-hint" style={{ color: '#64748b', fontSize: 14 }}>
            支持多张图片上传，格式为 JPG/PNG/WEBP
          </p>
        </Dragger>

        {/* OCR识别按钮 */}
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Button
            type="primary"
            size="large"
            onClick={handleOcrRecognize}
            loading={ocrLoading}
            disabled={fileList.length === 0}
            style={{
              borderRadius: 14,
              height: 48,
              background: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
              border: 'none',
              fontWeight: 600,
            }}
          >
            <CameraOutlined style={{ marginRight: 10 }} />
            开始OCR识别
          </Button>
        </div>

        {/* OCR成功提示 */}
        {ocrSuccess && (
          <Card
            style={{
              marginTop: 24,
              borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(52, 211, 153, 0.08) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: '#10B981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckCircleOutlined style={{ fontSize: 26, color: '#fff' }} />
              </div>
              <div>
                <Text strong style={{ fontSize: 16, color: '#10B981' }}>OCR识别成功</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 14 }}>已自动填充识别结果，请核对并修正数据</Text>
              </div>
            </div>
          </Card>
        )}
      </Card>

      {/* 项目编号查询区域 */}
      <Card
        style={{
          borderRadius: 24,
          marginBottom: 32,
          border: '1px solid var(--color-border-light)',
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <Title level={4} style={{ marginBottom: 8, fontWeight: 600 }}>
            <SearchOutlined style={{ marginRight: 10, color: '#8B5CF6' }} />
            项目编号查询
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>输入项目编号查询已保存的项目信息和人员列表</Text>
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Input
            value={projectCode}
            onChange={(e) => setProjectCode(e.target.value)}
            onBlur={() => {
              if (projectCode.trim()) {
                handleQueryByProjectCode()
              }
            }}
            placeholder="请输入项目编号"
            style={{ flex: 1, maxWidth: 400, borderRadius: 10, height: 42 }}
            onPressEnter={handleQueryByProjectCode}
          />
          <Button
            type="primary"
            size="large"
            onClick={handleQueryByProjectCode}
            loading={querying}
            style={{
              borderRadius: 10,
              height: 42,
              background: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)',
              border: 'none',
              fontWeight: 600,
            }}
          >
            <SearchOutlined style={{ marginRight: 8 }} />
            查询
          </Button>
        </div>
      </Card>

      {/* OCR识别结果展示表单 */}
      <Card
        style={{
          borderRadius: 24,
          marginBottom: 32,
          border: '1px solid var(--color-border-light)',
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <Title level={4} style={{ marginBottom: 8, fontWeight: 600 }}>
            <DollarOutlined style={{ marginRight: 10, color: '#3B82F6' }} />
            项目信息
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>请核对OCR识别结果或手动输入项目财务数据（带*为必填项）</Text>
        </div>

        <Form form={form} layout="vertical" initialValues={{
          contractAmount: 0,
          preSaleRatio: 0,
          taxRate: 0.06,
          externalLaborCost: 0,
          externalSoftwareCost: 0,
          otherCost: 0,
          currentManpowerCost: 0,
        }}>
          <Row gutter={28}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                label={
                  <span>
                    合同金额(万元) *
                    <Tooltip title="项目合同总金额">
                      <InfoCircleOutlined style={{ color: '#64748b', marginLeft: 6 }} />
                    </Tooltip>
                  </span>
                }
                name="contractAmount"
                rules={[{ required: true, message: '请输入合同金额' }]}
              >
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: '100%', borderRadius: 10 }}
                  placeholder="请输入合同金额"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                label={
                  <span>
                    售前比例 *
                    <Tooltip title="售前成本占总合同的比例，如 0.15 表示 15%">
                      <InfoCircleOutlined style={{ color: '#64748b', marginLeft: 6 }} />
                    </Tooltip>
                  </span>
                }
                name="preSaleRatio"
                rules={[{ required: true, message: '请输入售前比例' }]}
              >
                <InputNumber
                  min={0}
                  max={1}
                  precision={4}
                  style={{ width: '100%', borderRadius: 10 }}
                  placeholder="如: 0.15"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                label={
                  <span>
                    税率 *
                    <Tooltip title="项目税率，如 0.06 表示 6%">
                      <InfoCircleOutlined style={{ color: '#64748b', marginLeft: 6 }} />
                    </Tooltip>
                  </span>
                }
                name="taxRate"
                rules={[{ required: true, message: '请输入税率' }]}
              >
                <InputNumber
                  min={0}
                  max={1}
                  precision={4}
                  style={{ width: '100%', borderRadius: 10 }}
                  placeholder="如: 0.06"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                label={
                  <span>
                    外采人力成本(万元) *
                    <Tooltip title="外包人力成本">
                      <InfoCircleOutlined style={{ color: '#64748b', marginLeft: 6 }} />
                    </Tooltip>
                  </span>
                }
                name="externalLaborCost"
                rules={[{ required: true, message: '请输入外采人力成本' }]}
              >
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: '100%', borderRadius: 10 }}
                  placeholder="请输入外采人力成本"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                label={
                  <span>
                    外采软件成本(万元) *
                    <Tooltip title="外包软件采购成本">
                      <InfoCircleOutlined style={{ color: '#64748b', marginLeft: 6 }} />
                    </Tooltip>
                  </span>
                }
                name="externalSoftwareCost"
                rules={[{ required: true, message: '请输入外采软件成本' }]}
              >
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: '100%', borderRadius: 10 }}
                  placeholder="请输入外采软件成本"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                label={
                  <span>
                    其它成本(万元) *
                    <Tooltip title="其它类型成本支出">
                      <InfoCircleOutlined style={{ color: '#64748b', marginLeft: 6 }} />
                    </Tooltip>
                  </span>
                }
                name="otherCost"
                rules={[{ required: true, message: '请输入其它成本' }]}
              >
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: '100%', borderRadius: 10 }}
                  placeholder="请输入其它成本"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                label={
                  <span>
                    当前人力成本(万元) *
                    <Tooltip title="已消耗的人力成本">
                      <InfoCircleOutlined style={{ color: '#64748b', marginLeft: 6 }} />
                    </Tooltip>
                  </span>
                }
                name="currentManpowerCost"
                rules={[{ required: true, message: '请输入当前人力成本' }]}
              >
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: '100%', borderRadius: 10 }}
                  placeholder="请输入当前人力成本"
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      {/* 项目成员列表表格 */}
      <Card
        style={{
          borderRadius: 24,
          marginBottom: 32,
          border: '1px solid var(--color-border-light)',
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <Title level={4} style={{ marginBottom: 8, fontWeight: 600 }}>
            <TeamOutlined style={{ marginRight: 10, color: '#8B5CF6' }} />
            项目成员列表
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>添加项目成员信息，系统将自动计算人力成本</Text>
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
                        borderRadius: 10,
                        background: '#8B5CF612',
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

        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={handleAddMember}
          style={{
            marginTop: 20,
            width: '100%',
            borderRadius: 14,
            height: 48,
            borderStyle: 'dashed',
          }}
        >
          新增成员
        </Button>

        {/* 保存项目人员按钮 */}
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSaveMembers}
            loading={saving}
            style={{
              borderRadius: 14,
              height: 48,
              background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
              border: 'none',
              fontWeight: 600,
            }}
          >
            保存项目人员
          </Button>
        </div>
      </Card>

      {/* 操作按钮 */}
      <Card
        style={{
          borderRadius: 20,
          border: '1px solid var(--color-border-light)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            size="large"
            onClick={() => navigate('/dashboard')}
            style={{ borderRadius: 14, height: 48 }}
          >
            返回首页
          </Button>
          <div style={{ display: 'flex', gap: 16 }}>
            <Button
              size="large"
              icon={<SaveOutlined />}
              onClick={handleSaveMembers}
              loading={saving}
              style={{ borderRadius: 14, height: 48 }}
            >
              保存人员
            </Button>
            <Button
              type="primary"
              size="large"
              onClick={handleCalculate}
              loading={saving}
              style={{
                borderRadius: 14,
                height: 48,
                background: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
                border: 'none',
                fontWeight: 600,
              }}
            >
              开始核算
              <ArrowRightOutlined style={{ marginLeft: 10 }} />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}