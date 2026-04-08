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
} from 'antd'
import {
  InboxOutlined,
  FileTextOutlined,
  SettingOutlined,
  FileSearchOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  RocketOutlined,
  ArrowRightOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import type { UploadProps, UploadFile } from 'antd'
import { estimateApi } from '@/api'

const { Title, Text, Paragraph } = Typography
const { Dragger } = Upload

// 步骤条配置（4步）- 调整顺序：上传->解析->配置->结果
const stepItems = [
  {
    title: '文件上传',
    description: '上传需求文档',
    icon: <FileTextOutlined />,
  },
  {
    title: '文档解析',
    description: '查看功能点详情',
    icon: <FileSearchOutlined />,
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
  { icon: '📄', text: '支持文件格式：DOC、DOCX' },
  { icon: '📦', text: '文件大小限制：不超过 50MB' },
  { icon: '📝', text: '文档内容要求：包含功能模块描述、技术栈信息' },
  { icon: '✨', text: '建议格式：清晰的功能模块划分，明确的技术架构描述' },
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
    name: 'document',
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
      {/* 功能介绍区域 - 简约风格 */}
      <div
        style={{
          background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
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
            <RocketOutlined style={{ fontSize: 32, color: '#fff' }} />
          </div>
          <div>
            <Title level={3} style={{ color: '#fff', margin: 0, marginBottom: 10 }}>
              实施成本预估
            </Title>
            <Paragraph style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 15, margin: 0, lineHeight: 1.6 }}>
              上传需求文档，AI智能解析功能模块，精准计算实施工作量与成本
            </Paragraph>
          </div>
        </div>
      </div>

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

      {/* 上传区域 */}
      <Card
        style={{
          borderRadius: 24,
          marginBottom: 32,
          border: '1px solid var(--color-border-light)',
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <Title level={4} style={{ marginBottom: 8, fontWeight: 600 }}>
            <FileTextOutlined style={{ marginRight: 10, color: '#3B82F6' }} />
            上传需求文档
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>请上传包含功能需求描述的文档文件</Text>
        </div>

        <Dragger {...draggerProps} disabled={uploading}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ color: '#3B82F6', fontSize: 52 }} />
          </p>
          <p className="ant-upload-text" style={{ fontSize: 16, fontWeight: 500, color: '#0f172a' }}>
            点击或拖拽文件到此区域上传
          </p>
          <p className="ant-upload-hint" style={{ color: '#64748b', fontSize: 14 }}>
            仅支持 DOC/DOCX 格式的需求文档
          </p>
        </Dragger>

        {/* 上传进度 */}
        {(uploading || (uploadProgress === 100 && uploadedProjectId)) && (
          <div style={{ marginTop: 28 }}>
            <Progress
              percent={uploadProgress}
              status={uploadProgress === 100 ? 'success' : 'active'}
              strokeColor={{
                '0%': '#3B82F6',
                '100%': '#10B981',
              }}
            />
            <Text type="secondary" style={{ fontSize: 14 }}>
              {uploadProgress === 100 ? '文件上传完成' : '正在上传文件，请稍候...'}
            </Text>
          </div>
        )}

        {/* 上传成功提示 */}
        {uploadProgress === 100 && uploadedProjectId && (
          <Card
            style={{
              marginTop: 20,
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
                <Text strong style={{ fontSize: 16, color: '#10B981' }}>文档上传成功</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 14 }}>文件已成功上传，请点击"下一步"按钮继续配置参数</Text>
              </div>
            </div>
          </Card>
        )}
      </Card>

      {/* 格式要求说明 */}
      <Card
        style={{
          borderRadius: 24,
          marginBottom: 32,
          border: '1px solid var(--color-border-light)',
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <Title level={4} style={{ marginBottom: 8, fontWeight: 600 }}>
            <InfoCircleOutlined style={{ marginRight: 10, color: '#8B5CF6' }} />
            文档格式要求
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>请确保文档符合以下规范，以便系统准确解析</Text>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {formatRequirements.map((req, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: 20,
                borderRadius: 16,
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border-light)',
              }}
            >
              <span style={{ fontSize: 26 }}>{req.icon}</span>
              <Text style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>{req.text}</Text>
            </div>
          ))}
        </div>

        <Card
          style={{
            marginTop: 24,
            borderRadius: 14,
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.15)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#3B82F6',
              }}
            />
            <Text style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
              请确保上传的文档包含完整的功能需求描述，以便系统能够准确解析和计算实施成本。
            </Text>
          </div>
        </Card>
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
            style={{
              borderRadius: 14,
              height: 48,
            }}
          >
            返回首页
          </Button>
          <Button
            type="primary"
            size="large"
            disabled={!uploadedProjectId}
            onClick={() => navigate(`/cost-estimate/parse-result?projectId=${uploadedProjectId}`)}
            style={{
              borderRadius: 14,
              height: 48,
              background: uploadedProjectId
                ? 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)'
                : '#e2e8f0',
              border: 'none',
              fontWeight: 600,
            }}
          >
            下一步：文档解析
            <ArrowRightOutlined style={{ marginLeft: 10 }} />
          </Button>
        </div>
      </Card>
    </div>
  )
}