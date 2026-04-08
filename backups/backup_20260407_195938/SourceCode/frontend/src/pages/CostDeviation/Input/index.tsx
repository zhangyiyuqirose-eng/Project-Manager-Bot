import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card,
  Steps,
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
} from 'antd'
import {
  InboxOutlined,
  EditOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  UploadOutlined,
  MonitorOutlined,
  CameraOutlined,
  ArrowRightOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import type { UploadProps, UploadFile } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { deviationApi } from '@/api'
import type { ProjectMemberInfo, BaselineMode } from '@/types'

const { Text, Title } = Typography
const { Dragger } = Upload

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

// 截图类型配置
const screenshotTypes = [
  {
    key: 'contract',
    title: '项目合同金额截图',
    description: '上传包含合同金额信息的截图',
    icon: '💰',
    color: '#3B82F6',
  },
  {
    key: 'manpower',
    title: '项目当前人力成本截图',
    description: '上传包含当前人力成本统计的截图',
    icon: '👥',
    color: '#10B981',
  },
  {
    key: 'members',
    title: '项目当前成员明细截图',
    description: '上传包含团队成员详细信息的多张截图',
    icon: '📋',
    color: '#8B5CF6',
  },
  {
    key: 'devops',
    title: 'DevOps任务完成情况截图',
    description: '上传DevOps系统中任务进度相关截图',
    icon: '📊',
    color: '#F59E0B',
  },
]

// 默认阶段比例配置
const defaultStageRatios = [
  { stage: '需求', ratio: 15 },
  { stage: '设计', ratio: 20 },
  { stage: '开发', ratio: 35 },
  { stage: '技术测试', ratio: 15 },
  { stage: '性能测试', ratio: 5 },
  { stage: '投产', ratio: 10 },
]

// 成员信息表格列配置
const memberColumns: ColumnsType<ProjectMemberInfo> = [
  {
    title: '姓名',
    dataIndex: 'name',
    key: 'name',
    width: 100,
    render: (value: string) => (
      <Text style={{ fontWeight: 500, color: '#0f172a' }}>{value}</Text>
    ),
  },
  {
    title: '角色',
    dataIndex: 'role',
    key: 'role',
    width: 120,
    render: (value: string) => (
      <Text style={{
        padding: '4px 12px',
        borderRadius: 8,
        background: '#f1f5f9',
        color: '#475569',
        fontSize: 12,
      }}>
        {value}
      </Text>
    ),
  },
  {
    title: '级别',
    dataIndex: 'level',
    key: 'level',
    width: 80,
    render: (value: string) => (
      <Text style={{
        padding: '4px 12px',
        borderRadius: 8,
        background: '#3B82F615',
        color: '#3B82F6',
        fontSize: 12,
        fontWeight: 500,
      }}>
        {value}
      </Text>
    ),
  },
  {
    title: '已报工时(小时)',
    dataIndex: 'reportedHours',
    key: 'reportedHours',
    width: 120,
    render: (value: number) => (
      <Text strong style={{ color: '#3B82F6' }}>
        {value?.toFixed(1) || '-'}
      </Text>
    ),
  },
]

export default function CostDeviationInput() {
  const navigate = useNavigate()
  const [form] = Form.useForm()

  // 步骤状态
  const [currentStep, setCurrentStep] = useState(0)

  // 截图上传状态
  const [screenshotFiles, setScreenshotFiles] = useState<Record<string, UploadFile[]>>({
    contract: [],
    manpower: [],
    members: [],
    devops: [],
  })
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // AI识别状态
  const [recognizing, setRecognizing] = useState(false)
  const [recognitionResult, setRecognitionResult] = useState<any>(null)
  const [projectId, setProjectId] = useState<number | null>(null)

  // 基准模式状态
  const [baselineMode, setBaselineMode] = useState<BaselineMode>('default')
  const [baselineFileList, setBaselineFileList] = useState<UploadFile[]>([])
  const [stageRatios, setStageRatios] = useState(defaultStageRatios)

  // 预期利润空间
  const [expectedProfit, setExpectedProfit] = useState<number>(15)

  // 开始分析状态
  const [analyzing, setAnalyzing] = useState(false)

  // 校验阶段比例合计是否为100%
  const validateStageRatios = () => {
    const total = stageRatios.reduce((sum, item) => sum + item.ratio, 0)
    return total === 100
  }

  // 处理截图上传
  const handleScreenshotUpload = async (type: string) => {
    const files = screenshotFiles[type]
    if (!files || files.length === 0) {
      message.warning('请先选择要上传的截图')
      return
    }

    setUploading(true)
    setUploadProgress(0)

    try {
      // 模拟上传进度
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      const uploadFiles = files.map((f) => f.originFileObj as File).filter(Boolean)
      const response = await deviationApi.uploadImages(uploadFiles, type)

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (response.data.code === 0 || response.data.code === 200) {
        message.success(`${screenshotTypes.find(t => t.key === type)?.title}上传成功`)
        if (response.data.data?.projectId) {
          setProjectId(response.data.data.projectId)
        }
      }
    } catch {
      message.error('上传失败')
    } finally {
      setUploading(false)
    }
  }

  // AI识别处理
  const handleAiRecognize = async () => {
    if (!projectId) {
      message.warning('请先上传截图')
      return
    }

    setRecognizing(true)
    try {
      const response = await deviationApi.aiRecognize(projectId)
      if (response.data.code === 0 || response.data.code === 200) {
        setRecognitionResult(response.data.data)
        message.success('AI识别完成')

        // 自动填充表单
        if (response.data.data) {
          form.setFieldsValue({
            projectName: response.data.data.projectName,
            contractAmount: response.data.data.contractAmount,
            currentManpowerCost: response.data.data.currentManpowerCost,
            taskProgress: response.data.data.taskProgress,
          })
        }
      }
    } catch {
      message.error('AI识别失败')
    } finally {
      setRecognizing(false)
    }
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

  // 开始分析
  const handleStartAnalysis = async () => {
    if (!projectId) {
      message.warning('请先完成信息录入')
      return
    }

    if (!recognitionResult) {
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
        setCurrentStep(1)
        navigate(`/cost-deviation/result?projectId=${projectId}`)
      }
    } catch {
      message.error('分析失败')
    } finally {
      setAnalyzing(false)
    }
  }

  // 截图上传组件配置
  const getDraggerProps = (type: string): UploadProps => ({
    name: 'files',
    multiple: true,
    fileList: screenshotFiles[type],
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
      return false // 阻止自动上传，手动控制
    },
    onChange: (info) => {
      setScreenshotFiles((prev) => ({
        ...prev,
        [type]: info.fileList,
      }))
    },
    accept: 'image/*',
    showUploadList: {
      showDownloadIcon: false,
      showRemoveIcon: true,
    },
  })

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

      {/* 功能介绍区域 */}
      <div
        style={{
          background: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
          borderRadius: 24,
          padding: '48px 48px',
          marginBottom: 32,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 28 }}>
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: 18,
              background: 'rgba(255, 255, 255, 0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MonitorOutlined style={{ fontSize: 32, color: '#fff' }} />
          </div>
          <div>
            <Title level={3} style={{ color: '#fff', margin: 0, marginBottom: 10 }}>
              成本偏差监控
            </Title>
            <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 15, lineHeight: 1.6 }}>
              AI智能识别项目截图，分析成本偏差，提供调整建议
            </Text>
          </div>
        </div>
      </div>

      {/* 截图上传区域 */}
      <Card
        style={{
          borderRadius: 24,
          marginBottom: 32,
          border: '1px solid var(--color-border-light)',
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <Title level={4} style={{ marginBottom: 8, fontWeight: 600 }}>
            <CameraOutlined style={{ marginRight: 10, color: '#8B5CF6' }} />
            上传项目截图
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>请上传以下4类截图，AI将自动识别并提取关键信息</Text>
        </div>

        <Row gutter={[20, 20]}>
          {screenshotTypes.map((type) => (
            <Col xs={24} md={12} key={type.key}>
              <Card
                style={{
                  borderRadius: 18,
                  border: '1px solid var(--color-border-light)',
                  height: '100%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span style={{ fontSize: 26 }}>{type.icon}</span>
                    <div>
                      <Text strong style={{ fontSize: 14 }}>{type.title}</Text>
                    </div>
                  </div>
                  <Button
                    type="primary"
                    size="small"
                    icon={<UploadOutlined />}
                    onClick={() => handleScreenshotUpload(type.key)}
                    disabled={screenshotFiles[type.key].length === 0 || uploading}
                    style={{
                      borderRadius: 10,
                      background: type.color,
                      border: 'none',
                    }}
                  >
                    上传
                  </Button>
                </div>
                <Dragger {...getDraggerProps(type.key)} disabled={uploading}>
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined style={{ color: type.color, fontSize: 36 }} />
                  </p>
                  <p className="ant-upload-text" style={{ fontSize: 13 }}>
                    点击或拖拽图片到此区域
                  </p>
                  <p className="ant-upload-hint" style={{ fontSize: 12 }}>
                    {type.description}
                  </p>
                </Dragger>
              </Card>
            </Col>
          ))}
        </Row>

        {/* 上传进度 */}
        {uploading && (
          <div style={{ marginTop: 24 }}>
            <Progress
              percent={uploadProgress}
              status={uploadProgress === 100 ? 'success' : 'active'}
              strokeColor={{
                '0%': '#8B5CF6',
                '100%': '#10B981',
              }}
            />
          </div>
        )}

        {/* AI识别按钮 */}
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
          <Button
            type="primary"
            size="large"
            icon={<CheckCircleOutlined />}
            onClick={handleAiRecognize}
            loading={recognizing}
            disabled={!projectId || uploading}
            style={{
              borderRadius: 14,
              height: 48,
              background: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
              border: 'none',
              fontWeight: 600,
            }}
          >
            开始AI识别
          </Button>
          <Tooltip title="AI将识别上传的截图，提取项目名称、合同金额、人力成本等信息">
            <InfoCircleOutlined style={{ color: '#64748b', marginLeft: 14, alignSelf: 'center' }} />
          </Tooltip>
        </div>
      </Card>

      {/* AI识别结果展示 */}
      {recognizing && (
        <Card
          style={{
            borderRadius: 24,
            marginBottom: 32,
            border: '1px solid var(--color-border-light)',
          }}
        >
          <Spin tip="AI正在识别截图内容...">
            <div style={{ height: 100 }} />
          </Spin>
        </Card>
      )}

      {recognitionResult && !recognizing && (
        <Card
          style={{
            borderRadius: 24,
            marginBottom: 32,
            border: '1px solid var(--color-border-light)',
          }}
        >
          <div style={{ marginBottom: 24 }}>
            <Title level={4} style={{ marginBottom: 8, fontWeight: 600 }}>
              <CheckCircleOutlined style={{ marginRight: 10, color: '#10B981' }} />
              AI识别结果
            </Title>
            <Text type="secondary" style={{ fontSize: 14 }}>以下信息已从截图自动识别提取，如有偏差可手动修正</Text>
          </div>

          <Card
            style={{
              marginBottom: 24,
              borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(52, 211, 153, 0.08) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <CheckCircleOutlined style={{ color: '#10B981', fontSize: 18 }} />
              <Text style={{ color: '#10B981', fontWeight: 500 }}>识别成功，数据已自动填充</Text>
            </div>
          </Card>

          <Form form={form} layout="vertical">
            <Row gutter={28}>
              <Col xs={24} md={8}>
                <Form.Item label="项目名称" name="projectName">
                  <Input placeholder="请输入项目名称" style={{ borderRadius: 10 }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="合同金额(万元)" name="contractAmount">
                  <InputNumber
                    placeholder="请输入合同金额"
                    min={0}
                    precision={2}
                    style={{ width: '100%', borderRadius: 10 }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="当前人力成本(万元)" name="currentManpowerCost">
                  <InputNumber
                    placeholder="请输入人力成本"
                    min={0}
                    precision={2}
                    style={{ width: '100%', borderRadius: 10 }}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label="任务完成进度(%)" name="taskProgress">
              <InputNumber
                placeholder="请输入任务进度"
                min={0}
                max={100}
                precision={1}
                style={{ width: 300, borderRadius: 10 }}
              />
            </Form.Item>

            {/* 项目成员信息表格 */}
            {recognitionResult.members && recognitionResult.members.length > 0 && (
              <Form.Item label="项目成员信息">
                <Table
                  columns={memberColumns}
                  dataSource={recognitionResult.members}
                  rowKey="name"
                  pagination={false}
                  size="small"
                />
              </Form.Item>
            )}
          </Form>
        </Card>
      )}

      {/* 分析基准配置 */}
      <Card
        style={{
          borderRadius: 24,
          marginBottom: 32,
          border: '1px solid var(--color-border-light)',
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <Title level={4} style={{ marginBottom: 8, fontWeight: 600 }}>
            <SettingOutlined style={{ marginRight: 10, color: '#F59E0B' }} />
            分析基准配置
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>选择分析基准模式，用于计算各阶段成本偏差对比</Text>
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

          {/* 模式1：上传工作量评估表 */}
          {baselineMode === 'custom' && (
            <Form.Item label="工作量评估表">
              <Dragger {...baselineUploadProps}>
                <p className="ant-upload-drag-icon">
                  <InboxOutlined style={{ color: '#F59E0B', fontSize: 36 }} />
                </p>
                <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                <p className="ant-upload-hint">仅支持 Excel 格式的工作量评估表</p>
              </Dragger>
              <Button
                type="primary"
                icon={<UploadOutlined />}
                onClick={handleBaselineUpload}
                disabled={baselineFileList.length === 0}
                style={{ marginTop: 16, borderRadius: 10 }}
              >
                上传评估表
              </Button>
            </Form.Item>
          )}

          {/* 模式2：系统默认比例（可编辑） */}
          {baselineMode === 'default' && (
            <Form.Item label="阶段比例配置">
              <Card
                style={{
                  marginBottom: 20,
                  borderRadius: 14,
                  background: validateStageRatios()
                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(52, 211, 153, 0.08) 100%)'
                    : 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(251, 191, 36, 0.08) 100%)',
                  border: validateStageRatios()
                    ? '1px solid rgba(16, 185, 129, 0.25)'
                    : '1px solid rgba(245, 158, 11, 0.25)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {validateStageRatios() ? (
                    <CheckCircleOutlined style={{ color: '#10B981' }} />
                  ) : (
                    <InfoCircleOutlined style={{ color: '#F59E0B' }} />
                  )}
                  <Text>
                    当前比例合计: {stageRatios.reduce((sum, item) => sum + item.ratio, 0)}%
                    {validateStageRatios() ? ' (配置正确)' : ' (请调整至100%)'}
                  </Text>
                </div>
              </Card>

              <Row gutter={[16, 16]}>
                {stageRatios.map((item, index) => (
                  <Col xs={12} md={8} lg={4} key={item.stage}>
                    <Card
                      size="small"
                      style={{ borderRadius: 14, textAlign: 'center' }}
                    >
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {item.stage}
                      </Text>
                      <InputNumber
                        value={item.ratio}
                        onChange={(value) => {
                          const newRatios = [...stageRatios]
                          newRatios[index].ratio = value || 0
                          setStageRatios(newRatios)
                        }}
                        min={0}
                        max={100}
                        precision={0}
                        style={{ width: '100%', marginTop: 10, borderRadius: 10 }}
                        addonAfter="%"
                      />
                    </Card>
                  </Col>
                ))}
              </Row>
            </Form.Item>
          )}

          {/* 预期利润空间 */}
          <Form.Item
            label={
              <span>
                预期利润空间(%)
                <Tooltip title="预留的利润空间比例，用于计算合理成本消耗">
                  <InfoCircleOutlined style={{ color: '#64748b', marginLeft: 6 }} />
                </Tooltip>
              </span>
            }
          >
            <InputNumber
              value={expectedProfit}
              onChange={(value) => setExpectedProfit(value || 0)}
              min={0}
              max={50}
              precision={1}
              style={{ width: 200, borderRadius: 10 }}
              addonAfter="%"
            />
          </Form.Item>
        </Form>
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
          <Button
            type="primary"
            size="large"
            icon={<BarChartOutlined />}
            onClick={handleStartAnalysis}
            loading={analyzing}
            disabled={!recognitionResult || !validateStageRatios()}
            style={{
              borderRadius: 14,
              height: 48,
              background: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
              border: 'none',
              fontWeight: 600,
            }}
          >
            开始分析
            <ArrowRightOutlined style={{ marginLeft: 10 }} />
          </Button>
        </div>
      </Card>
    </div>
  )
}