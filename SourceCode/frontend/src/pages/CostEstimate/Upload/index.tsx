import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card,
  Upload,
  Button,
  Progress,
  Typography,
  message,
  Alert,
} from 'antd'
import {
  InboxOutlined,
  FileTextOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  CalculatorOutlined,
} from '@ant-design/icons'
import type { UploadProps, UploadFile } from 'antd'
import { estimateApi } from '@/api'
import PageTitle from '@/components/common/PageTitle'
import EstimateSteps from '@/components/common/EstimateSteps'

const { Text } = Typography
const { Dragger } = Upload

export default function CostEstimateUpload() {
  const navigate = useNavigate()
  const [currentStep] = useState(0)
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
      {/* 页面标题 */}
      <PageTitle
        title="实施成本预估"
        description="上传需求文档，AI智能解析功能模块，精准计算实施工作量与成本"
        icon={<CalculatorOutlined />}
      />

      {/* 步骤条 */}
      <EstimateSteps current={currentStep} />

      {/* 上传区域 */}
      <Card style={{ marginBottom: 20, borderRadius: 12 }}>
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: 15, color: '#1e293b' }}>
            <FileTextOutlined style={{ marginRight: 8, color: '#3B82F6' }} />
            上传需求文档
          </Text>
          <Text type="secondary" style={{ fontSize: 13, marginLeft: 8 }}>
            支持 DOC/DOCX 格式，不超过 50MB
          </Text>
        </div>

        <Dragger {...draggerProps} disabled={uploading}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ color: '#3B82F6', fontSize: 40 }} />
          </p>
          <p className="ant-upload-text" style={{ fontSize: 14, fontWeight: 500, color: '#0f172a' }}>
            点击或拖拽文件到此区域上传
          </p>
          <p className="ant-upload-hint" style={{ color: '#64748b', fontSize: 13 }}>
            仅支持 DOC/DOCX 格式的需求文档
          </p>
        </Dragger>

        {/* 上传进度 */}
        {uploading && (
          <div style={{ marginTop: 20 }}>
            <Progress percent={uploadProgress} status="active" strokeColor="#3B82F6" />
          </div>
        )}

        {/* 上传成功提示 */}
        {uploadProgress === 100 && uploadedProjectId && (
          <Alert
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
            message="文档上传成功"
            description="文件已成功上传，请点击「下一步」按钮继续配置参数"
            style={{ marginTop: 20, borderRadius: 8 }}
          />
        )}
      </Card>

      {/* 操作按钮 */}
      <Card style={{ borderRadius: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            size="large"
            onClick={() => navigate('/dashboard')}
            style={{ borderRadius: 10, height: 40 }}
          >
            返回首页
          </Button>
          <Button
            type="primary"
            size="large"
            disabled={!uploadedProjectId}
            onClick={() => navigate(`/cost-estimate/project-info?projectId=${uploadedProjectId}`)}
            style={{
              borderRadius: 10,
              height: 40,
              fontWeight: 500,
            }}
          >
            下一步：项目信息
            <ArrowRightOutlined style={{ marginLeft: 8 }} />
          </Button>
        </div>
      </Card>
    </div>
  )
}