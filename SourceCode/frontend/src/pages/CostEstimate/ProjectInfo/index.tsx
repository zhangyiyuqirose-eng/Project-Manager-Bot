import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Card,
  Button,
  Typography,
  Input,
  Select,
  message,
  Spin,
} from 'antd'
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import { estimateApi } from '@/api'
import PageTitle from '@/components/common/PageTitle'
import EstimateSteps from '@/components/common/EstimateSteps'

const { Text } = Typography

export default function CostEstimateProjectInfo() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('projectId')

  const [currentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // 表单数据
  const [projectName, setProjectName] = useState('')
  const [projectIdInput, setProjectIdInput] = useState('')
  const [systemName, setSystemName] = useState('')
  const [teamSize, setTeamSize] = useState<'small' | 'medium' | 'large'>('medium')

  // 加载项目信息
  useEffect(() => {
    if (!projectId) {
      message.warning('缺少项目ID')
      return
    }

    const loadProjectInfo = async () => {
      setLoading(true)
      try {
        const response = await estimateApi.getParseResult(Number(projectId))
        if (response.data.code === 0 || response.data.code === 200) {
          const parseResult = response.data.data?.parseResult
          if (parseResult) {
            setProjectName(parseResult.projectName || '')
            setSystemName(parseResult.systemName || '')
          }
        }
      } catch {
        // 静默处理
      } finally {
        setLoading(false)
      }
    }

    loadProjectInfo()
  }, [projectId])

  // 开始AI分析
  const handleStartAnalysis = async () => {
    if (!projectId) {
      message.warning('缺少项目ID')
      return
    }

    if (!projectName.trim()) {
      message.warning('请输入项目名称')
      return
    }

    setSaving(true)
    try {
      navigate(`/cost-estimate/ai-analysis?projectId=${projectId}&teamSize=${teamSize}`)
    } catch {
      message.error('操作失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <Card style={{ borderRadius: 12 }}>
          <Spin size="large" tip="加载项目信息..." />
        </Card>
      </div>
    )
  }

  if (!projectId) {
    return (
      <div className="page-container">
        <PageTitle title="项目信息" icon={<InfoCircleOutlined />} />
        <EstimateSteps current={currentStep} />
        <Card style={{ borderRadius: 12, textAlign: 'center', padding: 32 }}>
          <Text type="secondary">缺少项目ID，请先上传需求文档</Text>
          <br />
          <Button type="primary" onClick={() => navigate('/cost-estimate/upload')} style={{ marginTop: 16 }}>
            前往上传
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="page-container">
      {/* 页面标题 */}
      <PageTitle
        title="项目基本信息"
        description="填写项目基本信息，以便生成更准确的工作量评估报告"
        icon={<InfoCircleOutlined />}
      />

      {/* 步骤条 */}
      <EstimateSteps current={currentStep} />

      {/* 项目信息表单 */}
      <Card style={{ marginBottom: 20, borderRadius: 12 }}>
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: 15, color: '#1e293b' }}>项目信息配置</Text>
          <Text type="secondary" style={{ fontSize: 13, marginLeft: 8 }}>带 * 为必填项</Text>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
          {/* 项目名称 */}
          <div>
            <div style={{ marginBottom: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: 500, color: '#334155' }}>
                项目名称 <Text type="danger">*</Text>
              </Text>
            </div>
            <Input
              placeholder="例：人工智能Agent能力价值释放项目"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              style={{ borderRadius: 8, height: 36 }}
            />
          </div>

          {/* 项目编号 */}
          <div>
            <div style={{ marginBottom: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: 500, color: '#334155' }}>项目编号</Text>
            </div>
            <Input
              placeholder="例：PRJ-2026-001"
              value={projectIdInput}
              onChange={(e) => setProjectIdInput(e.target.value)}
              style={{ borderRadius: 8, height: 36 }}
            />
          </div>

          {/* 系统名称 */}
          <div>
            <div style={{ marginBottom: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: 500, color: '#334155' }}>系统名称</Text>
            </div>
            <Input
              placeholder="例：成本预估智能平台"
              value={systemName}
              onChange={(e) => setSystemName(e.target.value)}
              style={{ borderRadius: 8, height: 36 }}
            />
          </div>

          {/* 团队规模 */}
          <div>
            <div style={{ marginBottom: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: 500, color: '#334155' }}>团队规模（影响管理系数）</Text>
            </div>
            <Select
              value={teamSize}
              onChange={(val) => setTeamSize(val)}
              style={{ width: '100%', borderRadius: 8 }}
              options={[
                { value: 'small', label: '≤10人（管理系数 0.15）' },
                { value: 'medium', label: '11-20人（管理系数 0.20）' },
                { value: 'large', label: '＞20人（管理系数 0.25）' },
              ]}
              className="custom-select"
            />
          </div>
        </div>
      </Card>

      {/* 操作按钮 */}
      <Card style={{ borderRadius: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            size="large"
            onClick={() => navigate('/cost-estimate/upload')}
            style={{ borderRadius: 10, height: 40 }}
          >
            <ArrowLeftOutlined style={{ marginRight: 8 }} />
            上一步
          </Button>
          <Button
            type="primary"
            size="large"
            disabled={!projectName.trim()}
            onClick={handleStartAnalysis}
            loading={saving}
            style={{
              borderRadius: 10,
              height: 40,
              fontWeight: 500,
            }}
          >
            开始AI分析
            <ArrowRightOutlined style={{ marginLeft: 8 }} />
          </Button>
        </div>
      </Card>
    </div>
  )
}