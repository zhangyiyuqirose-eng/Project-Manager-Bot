import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card,
  Steps,
  Upload,
  Button,
  Progress,
  Alert,
  Space,
  Typography,
  message,
} from 'antd'
import {
  InboxOutlined,
  FileTextOutlined,
  SettingOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import type { UploadProps, UploadFile } from 'antd'
import { estimateApi } from '@/api'

const { Title, Text, Paragraph } = Typography
const { Dragger } = Upload

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

// 文档格式要求说明
const formatRequirements = [
  '支持文件格式：DOC、DOCX',
  '文件大小限制：不超过 50MB',
  '文档内容要求：包含功能模块描述、技术栈信息、系统关联说明',
  '建议格式：清晰的功能模块划分，明确的技术架构描述',
]

export default function CostEstimateUpload() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedProjectId, setUploadedProjectId] = useState<number | null>(null)

  // 文件上传前的格式校验
  const beforeUpload = (file: File) => {
    const isValidType =
      file.type === 'application/msword' ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.name.endsWith('.doc') ||
      file.name.endsWith('.docx')

    if (!isValidType) {
      message.error('仅支持 DOC/DOCX 格式的文件')
      return Upload.LIST_IGNORE
    }

    const isValidSize = file.size / 1024 / 1024 < 50
    if (!isValidSize) {
      message.error('文件大小不能超过 50MB')
      return Upload.LIST_IGNORE
    }

    return true
  }

  // 自定义上传处理
  const customRequest: UploadProps['customRequest'] = async (options) => {
    const { file, onSuccess, onError } = options
    const uploadFile = file as File

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

      const response = await estimateApi.uploadDocument(uploadFile)

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (response.data.code === 0 || response.data.code === 200) {
        const projectId = response.data.data?.projectId
        setUploadedProjectId(projectId)
        onSuccess?.(response.data.data)
        message.success('文件上传成功')
        setCurrentStep(1)

        // 延迟跳转到参数配置页
        setTimeout(() => {
          navigate(`/cost-estimate/config?projectId=${projectId}`)
        }, 1000)
      } else {
        onError?.(new Error(response.data.message || '上传失败'))
      }
    } catch (error) {
      onError?.(error as Error)
    } finally {
      setUploading(false)
    }
  }

  // 处理文件变化
  const handleChange: UploadProps['onChange'] = (info) => {
    setFileList(info.fileList)
  }

  // 拖拽上传配置
  const draggerProps: UploadProps = {
    name: 'file',
    multiple: false,
    fileList,
    beforeUpload,
    customRequest,
    onChange: handleChange,
    accept: '.doc,.docx',
    showUploadList: {
      showDownloadIcon: false,
      showRemoveIcon: true,
    },
  }

  return (
    <div className="page-container">
      {/* 步骤条 */}
      <Card className="card-margin">
        <Steps
          current={currentStep}
          items={stepItems}
          style={{ marginBottom: 24 }}
        />
      </Card>

      {/* 上传区域 */}
      <Card className="card-margin">
        <Title level={4} style={{ marginBottom: 16 }}>
          上传需求文档
        </Title>

        <Dragger {...draggerProps} disabled={uploading}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ color: '#165DFF', fontSize: 48 }} />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">仅支持 DOC/DOCX 格式的需求文档</p>
        </Dragger>

        {/* 上传进度 */}
        {uploading && (
          <div style={{ marginTop: 24 }}>
            <Progress
              percent={uploadProgress}
              status={uploadProgress === 100 ? 'success' : 'active'}
              strokeColor={{
                '0%': '#165DFF',
                '100%': '#00B42A',
              }}
            />
            <Text type="secondary">正在上传文件，请稍候...</Text>
          </div>
        )}

        {/* 上传成功提示 */}
        {uploadProgress === 100 && uploadedProjectId && (
          <Alert
            type="success"
            icon={<CheckCircleOutlined />}
            showIcon
            message="文档上传成功"
            description="文件已成功上传，即将跳转到参数配置页面..."
            style={{ marginTop: 16 }}
          />
        )}
      </Card>

      {/* 格式要求说明 */}
      <Card className="card-margin">
        <Title level={4} style={{ marginBottom: 16 }}>
          文档格式要求
        </Title>
        <Space direction="vertical" size="small">
          {formatRequirements.map((req, index) => (
            <Text key={index}>
              <CheckCircleOutlined style={{ color: '#00B42A', marginRight: 8 }} />
              {req}
            </Text>
          ))}
        </Space>

        <Paragraph type="secondary" style={{ marginTop: 16 }}>
          请确保上传的文档包含完整的功能需求描述，以便系统能够准确解析和计算实施成本。
        </Paragraph>
      </Card>

      {/* 操作按钮 */}
      <Card>
        <Space>
          <Button onClick={() => navigate('/dashboard')}>
            返回首页
          </Button>
          <Button
            type="primary"
            disabled={!uploadedProjectId}
            onClick={() => navigate(`/cost-estimate/config?projectId=${uploadedProjectId}`)}
          >
            下一步：参数配置
          </Button>
        </Space>
      </Card>
    </div>
  )
}