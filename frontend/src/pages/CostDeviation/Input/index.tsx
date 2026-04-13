import { useState } from 'react'
import {
  Card,
  Upload,
  Button,
  Progress,
  Typography,
  message,
  Row,
  Col,
  Form,
  Input,
  InputNumber,
  Table,
  Spin,
  Radio,
  Tooltip,
  Select,
  Statistic,
  Tag,
  Divider,
} from 'antd'
import {
  InboxOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  CameraOutlined,
  SettingOutlined,
  PlusOutlined,
  DeleteOutlined,
  TeamOutlined,
  DollarOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import type { UploadProps, UploadFile } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { deviationApi } from '@/api'
import type { MemberLevel, BaselineMode } from '@/types'

const { Text, Title } = Typography
const { Dragger } = Upload

// 默认阶段比例配置
const defaultStageRatios = [
  { stage: '需求', ratio: 15 },
  { stage: '设计', ratio: 20 },
  { stage: '开发', ratio: 35 },
  { stage: '技术测试', ratio: 15 },
  { stage: '性能测试', ratio: 5 },
  { stage: '投产', ratio: 10 },
]

// 成员等级选项
const levelOptions: { value: MemberLevel; label: string }[] = [
  { value: 'P5', label: 'P5' },
  { value: 'P6', label: 'P6' },
  { value: 'P7', label: 'P7' },
  { value: 'P8', label: 'P8' },
]

// 成员表单数据接口
interface MemberFormData {
  key: string
  name: string
  department?: string
  level: MemberLevel
  role?: string
  reportedHours: number
}

// 分析结果接口
interface AnalysisResult {
  totalContractAmount: number
  currentCostConsumption: number
  expectedCostConsumption: number
  costDeviation: number
  deviationRate: number
  taskProgress: number
  status: 'normal' | 'warning' | 'critical'
  stageDetails: { stage: string; expected: number; actual: number; deviation: number }[]
  suggestion: string
}

export default function CostDeviationInput() {
  const [form] = Form.useForm()

  // 截图上传状态
  const [screenshotFiles, setScreenshotFiles] = useState<UploadFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // AI识别状态
  const [recognizing, setRecognizing] = useState(false)
  const [projectId, setProjectId] = useState<number | null>(null)

  // 项目信息
  const [projectInfo, setProjectInfo] = useState<{
    projectName: string
    contractAmount: number
    currentManpowerCost: number
    devopsProgress: number
  } | null>(null)

  // 人员清单数据
  const [members, setMembers] = useState<MemberFormData[]>([])

  // 基准模式状态
  const [baselineMode, setBaselineMode] = useState<BaselineMode>('default')
  const [baselineFileList, setBaselineFileList] = useState<UploadFile[]>([])
  const [stageRatios, setStageRatios] = useState(defaultStageRatios)

  // 预期利润空间
  const [expectedProfit, setExpectedProfit] = useState<number>(15)

  // 分析状态和结果
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)

  // 校验阶段比例合计是否为100%
  const validateStageRatios = () => {
    const total = stageRatios.reduce((sum, item) => sum + item.ratio, 0)
    return total === 100
  }

  // 生成唯一key
  const generateKey = () => `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // 自动上传图片
  const autoUploadImages = async (files: UploadFile[]) => {
    if (files.length === 0) return

    setUploading(true)
    setUploadProgress(0)

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      const uploadFiles = files
        .map((f) => f.originFileObj)
        .filter((f): f is NonNullable<typeof f> => f !== undefined)
        .map((f) => f as File)

      if (uploadFiles.length === 0) {
        clearInterval(progressInterval)
        setUploading(false)
        return
      }

      const response = await deviationApi.uploadImages(uploadFiles)

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (response.data.code === 0 || response.data.code === 200) {
        message.success(`${uploadFiles.length} 张截图上传成功`)
        const returnedProjectId = response.data.data?.projectId
        if (returnedProjectId) {
          setProjectId(returnedProjectId)
        }
      } else {
        message.error(response.data.message || '上传失败')
      }
    } catch (error) {
      console.error('[Deviation] 上传错误:', error)
      message.error('上传失败，请重试')
    } finally {
      setUploading(false)
    }
  }

  // AI识别处理 - 调用本地OCR服务
  const handleAiRecognize = async () => {
    if (!projectId) {
      message.warning('请先上传截图')
      return
    }

    setRecognizing(true)
    try {
      const response = await deviationApi.aiRecognize(projectId)
      if (response.data.code === 0 || response.data.code === 200) {
        message.success('AI识别完成')

        // 自动填充项目信息
        if (response.data.data) {
          const data = response.data.data
          setProjectInfo({
            projectName: data.projectName || '',
            contractAmount: data.totalContractAmount || 0,
            currentManpowerCost: data.currentCostConsumption || 0,
            devopsProgress: data.taskProgress || 0,
          })

          form.setFieldsValue({
            projectName: data.projectName,
            contractAmount: data.totalContractAmount,
            currentManpowerCost: data.currentCostConsumption,
            taskProgress: data.taskProgress,
          })

          // 初始化成员列表
          if (data.members && data.members.length > 0) {
            setMembers(
              data.members.map((m: any) => ({
                key: generateKey(),
                name: m.name,
                department: m.department || '',
                level: m.level as MemberLevel,
                role: m.role || '',
                reportedHours: m.reportedHours || 0,
              }))
            )
          }
        }
      }
    } catch {
      message.error('AI识别失败，请检查OCR服务是否启动')
    } finally {
      setRecognizing(false)
    }
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
          onChange={(e) => handleMemberChange(record.key, 'name', e.target.value)}
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
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (value: MemberLevel, record) => (
        <Select
          value={value}
          onChange={(v: MemberLevel) => handleMemberChange(record.key, 'level', v)}
          options={levelOptions}
          placeholder="请选择等级"
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (value: string, record) => (
        <Input
          value={value || ''}
          onChange={(e) => handleMemberChange(record.key, 'role', e.target.value)}
          placeholder="请输入角色"
          style={{ width: '100%', borderRadius: 8 }}
        />
      ),
    },
    {
      title: '已报工时(小时)',
      dataIndex: 'reportedHours',
      key: 'reportedHours',
      width: 130,
      render: (value: number, record) => (
        <InputNumber
          value={value}
          onChange={(v) => handleMemberChange(record.key, 'reportedHours', v || 0)}
          min={0}
          precision={1}
          style={{ width: '100%', borderRadius: 8 }}
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
    value: string | number | MemberLevel
  ) => {
    setMembers((prev) =>
      prev.map((m) => (m.key === key ? { ...m, [field]: value } : m))
    )
  }

  // 新增成员
  const handleAddMember = () => {
    const newMember: MemberFormData = {
      key: generateKey(),
      name: '',
      department: '',
      level: 'P5' as MemberLevel,
      role: '',
      reportedHours: 0,
    }
    setMembers((prev) => [...prev, newMember])
  }

  // 删除成员
  const handleDeleteMember = (key: string) => {
    setMembers((prev) => prev.filter((m) => m.key !== key))
  }

  // 上传工作量评估表
  const handleBaselineUpload = async () => {
    if (baselineFileList.length === 0) {
      message.warning('请先选择工作量评估表文件')
      return
    }

    const file = baselineFileList[0].originFileObj as File
    if (!file) return

    try {
      const response = await deviationApi.saveBaseline(projectId!, {
        mode: 'custom',
        file,
      })
      if (response.data.code === 0 || response.data.code === 200) {
        message.success('工作量评估表上传成功')
        if (response.data.data?.stageRatios) {
          setStageRatios(response.data.data.stageRatios)
        }
      }
    } catch {
      message.error('上传失败')
    }
  }

  // 开始分析 - 在当前页面计算并显示结果
  const handleStartAnalysis = async () => {
    if (!projectId) {
      message.warning('请先上传截图并进行AI识别')
      return
    }

    if (!projectInfo) {
      message.warning('请先进行AI识别')
      return
    }

    if (!validateStageRatios()) {
      message.error('阶段比例合计必须为100%')
      return
    }

    setAnalyzing(true)
    try {
      // 保存基准配置
      await deviationApi.saveBaseline(projectId, {
        mode: baselineMode,
        stageRatios: baselineMode === 'default' ? stageRatios : undefined,
        expectedProfit,
      })

      // 计算偏差
      const response = await deviationApi.calculateDeviation(projectId)
      if (response.data.code === 0 || response.data.code === 200) {
        message.success('分析完成')
        setAnalysisResult(response.data.data)
      }
    } catch {
      message.error('分析失败')
    } finally {
      setAnalyzing(false)
    }
  }

  // 获取偏差状态颜色
  const getDeviationStatus = (deviation: number) => {
    if (deviation <= 10) return { color: '#10B981', text: '正常', tag: 'success' }
    if (deviation <= 20) return { color: '#F59E0B', text: '预警', tag: 'warning' }
    return { color: '#EF4444', text: '严重', tag: 'error' }
  }

  // 截图上传配置 - 选择图片后自动上传
  const uploadProps: UploadProps = {
    name: 'images',
    multiple: true,
    fileList: screenshotFiles,
    maxCount: 20,
    beforeUpload: (file: File) => {
      const isValidType = file.type.startsWith('image/')
      if (!isValidType) {
        message.error('仅支持图片格式文件')
        return Upload.LIST_IGNORE
      }
      const isValidSize = file.size / 1024 / 1024 < 10
      if (!isValidSize) {
        message.error('图片大小不能超过 10MB')
        return Upload.LIST_IGNORE
      }
      return false // 阻止自动上传
    },
    onChange: async (info) => {
      setScreenshotFiles(info.fileList)
      // 当有新文件添加时自动上传
      const newFiles = info.fileList.filter(f => f.originFileObj && !f.status)
      if (newFiles.length > 0 && !uploading) {
        await autoUploadImages(newFiles)
      }
    },
    onRemove: (file) => {
      const index = screenshotFiles.indexOf(file)
      const newFileList = screenshotFiles.slice()
      newFileList.splice(index, 1)
      setScreenshotFiles(newFileList)
    },
    accept: 'image/*',
    showUploadList: {
      showDownloadIcon: false,
      showRemoveIcon: true,
    },
  }

  // 基准文件上传配置
  const baselineUploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    fileList: baselineFileList,
    beforeUpload: (file: File) => {
      const isValidType =
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.name.endsWith('.xlsx') ||
        file.name.endsWith('.xls')
      if (!isValidType) {
        message.error('仅支持 Excel 格式文件')
        return Upload.LIST_IGNORE
      }
      return false
    },
    onChange: (info) => {
      setBaselineFileList(info.fileList.slice(-1))
    },
    accept: '.xlsx,.xls',
    showUploadList: {
      showDownloadIcon: false,
      showRemoveIcon: true,
    },
  }

  return (
    <div className="page-container">
      {/* 统一截图上传区域 */}
      <Card
        style={{
          borderRadius: 24,
          marginBottom: 24,
          border: '1px solid var(--color-border-light)',
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <Title level={4} style={{ marginBottom: 8, fontWeight: 600 }}>
            <CameraOutlined style={{ marginRight: 10, color: '#8B5CF6' }} />
            上传项目截图
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            选择图片后将自动上传，支持批量上传最多20张，单个文件不超过10MB
          </Text>
        </div>

        <Dragger {...uploadProps} disabled={uploading}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ color: '#8B5CF6', fontSize: 48 }} />
          </p>
          <p className="ant-upload-text" style={{ fontSize: 16, fontWeight: 500 }}>
            点击或拖拽多张图片到此区域
          </p>
          <p className="ant-upload-hint" style={{ fontSize: 13 }}>
            图片将自动上传，AI将识别提取项目名称、合同金额、人力成本、DevOps进度等信息
          </p>
        </Dragger>

        {/* 上传状态 */}
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text type="secondary">
            {uploading ? '上传中...' : `已上传 ${screenshotFiles.length} 张图片`}
            {projectId && <Tag color="success" style={{ marginLeft: 8 }}>已就绪</Tag>}
          </Text>
          {uploading && (
            <Progress
              percent={uploadProgress}
              size="small"
              style={{ width: 200 }}
              strokeColor="#8B5CF6"
            />
          )}
        </div>

        {/* AI识别按钮 */}
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Button
            type="primary"
            size="large"
            icon={<CheckCircleOutlined />}
            onClick={handleAiRecognize}
            loading={recognizing}
            disabled={!projectId || uploading}
            style={{
              borderRadius: 12,
              height: 44,
              fontWeight: 600,
            }}
          >
            开始AI识别
          </Button>
          <Tooltip title="调用本地OCR服务识别截图，提取项目名称、合同金额、人力成本、DevOps进度等信息">
            <InfoCircleOutlined style={{ color: '#64748b', marginLeft: 12 }} />
          </Tooltip>
        </div>
      </Card>

      {/* AI识别状态 */}
      {recognizing && (
        <Card style={{ borderRadius: 16, marginBottom: 24, textAlign: 'center', padding: 40 }}>
          <Spin size="large" tip="AI正在识别截图内容..." />
        </Card>
      )}

      {/* 项目信息模块 */}
      {projectInfo && !recognizing && (
        <Card
          style={{
            borderRadius: 16,
            marginBottom: 24,
            border: '1px solid var(--color-border-light)',
          }}
        >
          <div style={{ marginBottom: 20 }}>
            <Title level={4} style={{ marginBottom: 4, fontWeight: 600 }}>
              <DollarOutlined style={{ marginRight: 10, color: '#10B981' }} />
              项目信息概览
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>以下信息已从截图自动识别提取，如有偏差可手动修正</Text>
          </div>

          <Row gutter={[16, 16]}>
            <Col xs={12} sm={6}>
              <Card size="small" style={{ borderRadius: 12, textAlign: 'center', background: '#EFF6FF', border: 'none' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>项目名称</Text>
                <div style={{ marginTop: 8, fontWeight: 600, color: '#1E40AF', fontSize: 16 }}>
                  {projectInfo.projectName || '-'}
                </div>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small" style={{ borderRadius: 12, textAlign: 'center', background: '#ECFDF5', border: 'none' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>合同金额</Text>
                <div style={{ marginTop: 8, fontWeight: 600, color: '#065F46', fontSize: 16 }}>
                  {projectInfo.contractAmount?.toFixed(2) || '-'} 万元
                </div>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small" style={{ borderRadius: 12, textAlign: 'center', background: '#F5F3FF', border: 'none' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>人力成本</Text>
                <div style={{ marginTop: 8, fontWeight: 600, color: '#5B21B6', fontSize: 16 }}>
                  {projectInfo.currentManpowerCost?.toFixed(2) || '-'} 万元
                </div>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small" style={{ borderRadius: 12, textAlign: 'center', background: '#FFFBEB', border: 'none' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>DevOps进度</Text>
                <div style={{ marginTop: 8, fontWeight: 600, color: '#92400E', fontSize: 16 }}>
                  {projectInfo.devopsProgress?.toFixed(1) || '-'} %
                </div>
              </Card>
            </Col>
          </Row>

          {/* 可编辑的项目信息表单 */}
          <Form form={form} layout="vertical" style={{ marginTop: 20 }}>
            <Row gutter={20}>
              <Col xs={24} md={6}>
                <Form.Item label="项目名称" name="projectName">
                  <Input placeholder="请输入项目名称" style={{ borderRadius: 8 }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item label="合同金额(万元)" name="contractAmount">
                  <InputNumber
                    placeholder="请输入合同金额"
                    min={0}
                    precision={2}
                    style={{ width: '100%', borderRadius: 8 }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item label="当前人力成本(万元)" name="currentManpowerCost">
                  <InputNumber
                    placeholder="请输入人力成本"
                    min={0}
                    precision={2}
                    style={{ width: '100%', borderRadius: 8 }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item label="DevOps进度(%)" name="taskProgress">
                  <InputNumber
                    placeholder="请输入进度"
                    min={0}
                    max={100}
                    precision={1}
                    style={{ width: '100%', borderRadius: 8 }}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Card>
      )}

      {/* 人员清单模块 */}
      {projectInfo && !recognizing && (
        <Card
          style={{
            borderRadius: 16,
            marginBottom: 24,
            border: '1px solid var(--color-border-light)',
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <Title level={4} style={{ marginBottom: 4, fontWeight: 600 }}>
              <TeamOutlined style={{ marginRight: 10, color: '#F59E0B' }} />
              人员清单
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>管理项目团队成员信息，可新增、修改或删除成员</Text>
          </div>

          <Table
            columns={memberColumns}
            dataSource={members}
            rowKey="key"
            pagination={false}
            size="small"
            locale={{ emptyText: '暂无成员，请点击添加' }}
          />

          <div style={{ marginTop: 12 }}>
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={handleAddMember}
              style={{ borderRadius: 8 }}
            >
              新增成员
            </Button>
          </div>
        </Card>
      )}

      {/* 分析基准配置 */}
      {projectInfo && (
        <Card
          style={{
            borderRadius: 16,
            marginBottom: 24,
            border: '1px solid var(--color-border-light)',
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <Title level={4} style={{ marginBottom: 4, fontWeight: 600 }}>
              <SettingOutlined style={{ marginRight: 10, color: '#6366F1' }} />
              分析基准配置
            </Title>
          </div>

          <Form layout="vertical">
            <Form.Item label="基准模式选择">
              <Radio.Group
                value={baselineMode}
                onChange={(e) => setBaselineMode(e.target.value)}
                optionType="button"
                buttonStyle="solid"
              >
                <Radio.Button value="default">系统默认比例</Radio.Button>
                <Radio.Button value="custom">上传工作量评估表</Radio.Button>
              </Radio.Group>
            </Form.Item>

            {baselineMode === 'custom' && (
              <Form.Item label="工作量评估表">
                <Dragger {...baselineUploadProps}>
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined style={{ color: '#F59E0B', fontSize: 32 }} />
                  </p>
                  <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                </Dragger>
                <Button
                  type="primary"
                  icon={<DollarOutlined />}
                  onClick={handleBaselineUpload}
                  disabled={baselineFileList.length === 0}
                  style={{ marginTop: 12, borderRadius: 8 }}
                >
                  上传评估表
                </Button>
              </Form.Item>
            )}

            {baselineMode === 'default' && (
              <Form.Item label="阶段比例配置">
                <div style={{ marginBottom: 12 }}>
                  <Tag color={validateStageRatios() ? 'success' : 'warning'}>
                    比例合计: {stageRatios.reduce((sum, item) => sum + item.ratio, 0)}%
                  </Tag>
                </div>
                <Row gutter={[12, 12]}>
                  {stageRatios.map((item, index) => (
                    <Col xs={8} sm={4} key={item.stage}>
                      <div style={{ textAlign: 'center' }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>{item.stage}</Text>
                        <InputNumber
                          value={item.ratio}
                          onChange={(value) => {
                            const newRatios = [...stageRatios]
                            newRatios[index].ratio = value || 0
                            setStageRatios(newRatios)
                          }}
                          min={0}
                          max={100}
                          size="small"
                          style={{ width: '100%', marginTop: 4 }}
                          addonAfter="%"
                        />
                      </div>
                    </Col>
                  ))}
                </Row>
              </Form.Item>
            )}

            <Form.Item label="预期利润空间(%)">
              <InputNumber
                value={expectedProfit}
                onChange={(value) => setExpectedProfit(value || 0)}
                min={0}
                max={50}
                precision={1}
                style={{ width: 150 }}
                addonAfter="%"
              />
            </Form.Item>
          </Form>
        </Card>
      )}

      {/* 开始分析按钮 */}
      {projectInfo && (
        <Card style={{ borderRadius: 16, marginBottom: 24 }}>
          <Button
            type="primary"
            size="large"
            icon={<BarChartOutlined />}
            onClick={handleStartAnalysis}
            loading={analyzing}
            disabled={!projectInfo || !validateStageRatios()}
            style={{
              width: '100%',
              borderRadius: 12,
              height: 48,
              fontWeight: 600,
            }}
          >
            开始分析
          </Button>
        </Card>
      )}

      {/* 分析结果 - 在当前页面显示 */}
      {analysisResult && (
        <Card
          style={{
            borderRadius: 16,
            marginBottom: 24,
            border: '2px solid #8B5CF6',
          }}
        >
          <div style={{ marginBottom: 20 }}>
            <Title level={4} style={{ marginBottom: 4, fontWeight: 600 }}>
              <BarChartOutlined style={{ marginRight: 10, color: '#8B5CF6' }} />
              偏差分析结果
            </Title>
          </div>

          {/* 核心指标 */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={12} sm={6}>
              <Statistic
                title="合同金额"
                value={analysisResult.totalContractAmount}
                suffix="万元"
                precision={2}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title="当前成本消耗"
                value={analysisResult.currentCostConsumption}
                suffix="万元"
                precision={2}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title="预期成本消耗"
                value={analysisResult.expectedCostConsumption}
                suffix="万元"
                precision={2}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title="成本偏差率"
                value={analysisResult.deviationRate}
                suffix="%"
                precision={1}
                valueStyle={{ color: getDeviationStatus(analysisResult.deviationRate).color }}
              />
            </Col>
          </Row>

          {/* 状态显示 */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Tag
              color={getDeviationStatus(analysisResult.deviationRate).tag}
              style={{ fontSize: 16, padding: '8px 24px', borderRadius: 20 }}
            >
              {getDeviationStatus(analysisResult.deviationRate).text}
              {analysisResult.deviationRate <= 10 ? ' - 成本控制良好' :
               analysisResult.deviationRate <= 20 ? ' - 需要关注' : ' - 需要立即处理'}
            </Tag>
          </div>

          <Divider />

          {/* 阶段详情 */}
          {analysisResult.stageDetails && analysisResult.stageDetails.length > 0 && (
            <>
              <Title level={5} style={{ marginBottom: 12 }}>各阶段成本对比</Title>
              <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
                {analysisResult.stageDetails.map((stage) => (
                  <Col xs={12} sm={8} md={4} key={stage.stage}>
                    <Card size="small" style={{ borderRadius: 8, textAlign: 'center' }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>{stage.stage}</Text>
                      <div style={{ marginTop: 8 }}>
                        <div>预期: {stage.expected.toFixed(1)}万</div>
                        <div>实际: {stage.actual.toFixed(1)}万</div>
                        <div style={{
                          color: stage.deviation > 0 ? '#EF4444' : '#10B981',
                          fontWeight: 600
                        }}>
                          偏差: {stage.deviation > 0 ? '+' : ''}{stage.deviation.toFixed(1)}%
                        </div>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            </>
          )}

          {/* AI建议 */}
          {analysisResult.suggestion && (
            <>
              <Title level={5} style={{ marginBottom: 8 }}>AI建议</Title>
              <Card
                size="small"
                style={{
                  borderRadius: 8,
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0'
                }}
              >
                <Text>{analysisResult.suggestion}</Text>
              </Card>
            </>
          )}
        </Card>
      )}
    </div>
  )
}