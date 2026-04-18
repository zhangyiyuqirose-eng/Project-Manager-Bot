import { useState, useRef, useCallback } from 'react'
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
  SaveOutlined,
  TeamOutlined,
  BarChartOutlined,
  DollarOutlined,
} from '@ant-design/icons'
import type { UploadProps, UploadFile } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { deviationApi, consumptionApi, projectApi } from '@/api'
import { queryProjectByCode } from '@/utils/projectQuery'
import type { MemberLevel, BaselineMode } from '@/types'
import dayjs from 'dayjs'

// 成员级别日成本映射
const MEMBER_LEVEL_DAILY_COST: Record<MemberLevel, number> = {
  'P3': 0.08,
  'P4': 0.11,
  'P5': 0.16,
  'P6': 0.21,
  'P7': 0.26,
  'P8': 0.36
}

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

// 部门选项
const departmentOptions = [
  { value: '客服', label: '客服' },
  { value: '公司领导', label: '公司领导' },
  { value: '办公室（党委办公室、党委宣传部）', label: '办公室（党委办公室、党委宣传部）' },
  { value: '产品研发部', label: '产品研发部' },
  { value: '财务部', label: '财务部' },
  { value: '大数据开发部', label: '大数据开发部' },
  { value: '互联网应用开发事业部', label: '互联网应用开发事业部' },
  { value: '集成运维部', label: '集成运维部' },
  { value: '技术创新事业部', label: '技术创新事业部' },
  { value: '人工智能部', label: '人工智能部' },
  { value: '实习生', label: '实习生' },
  { value: '项目管理部', label: '项目管理部' },
  { value: '银行转型部', label: '银行转型部' },
  { value: '云计算应用部', label: '云计算应用部' },
  { value: '市场营销部', label: '市场营销部' },
  { value: '审计部', label: '审计部' },
  { value: '纪委办公室', label: '纪委办公室' },
  { value: '效能研发部', label: '效能研发部' },
  { value: '党委组织部（人力资源部）', label: '党委组织部（人力资源部）' },
  { value: '党群工作部', label: '党群工作部' },
  { value: '苏州分公司', label: '苏州分公司' },
  { value: '信息安全部', label: '信息安全部' },
  { value: '数字运营部', label: '数字运营部' },
  { value: '京津冀对外拓展工作室', label: '京津冀对外拓展工作室' },
  { value: '三方人员', label: '三方人员' },
  { value: '员工服务', label: '员工服务' },
]

// 角色选项
const roleOptions = [
  { value: '项目负责人', label: '项目负责人' },
  { value: '项目经理', label: '项目经理' },
  { value: '技术经理', label: '技术经理' },
  { value: '产品经理', label: '产品经理' },
  { value: 'UI设计', label: 'UI设计' },
  { value: '开发工程师', label: '开发工程师' },
  { value: '测试工程师', label: '测试工程师' },
]

// 成员表单数据接口
interface MemberFormData {
  key: string
  name: string
  department?: string
  level: MemberLevel
  role?: string
  reportedHours: number
  dailyCost: number
  entryTime?: string
  leaveTime?: string
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
    projectCode: string
    projectName: string
    contractAmount: number
    currentManpowerCost: number
    devopsProgress: number
  }>({
    projectCode: '',
    projectName: '',
    contractAmount: 0,
    currentManpowerCost: 0,
    devopsProgress: 0
  })

  // 人员清单数据
  const [members, setMembers] = useState<MemberFormData[]>([])

  // 基准模式状态
  const [baselineMode, setBaselineMode] = useState<BaselineMode>('default')
  const [baselineFileList, setBaselineFileList] = useState<UploadFile[]>([])
  const [stageRatios, setStageRatios] = useState(defaultStageRatios)

  // 预期利润空间
  const [expectedProfit, setExpectedProfit] = useState<number>(20)

  // 分析状态和结果
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)

  // 项目编号查询相关状态
  const [projectCode, setProjectCode] = useState('')
  const [querying, setQuerying] = useState(false)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 校验阶段比例合计是否为100%
  const validateStageRatios = () => {
    const total = stageRatios.reduce((sum, item) => sum + item.ratio, 0)
    return total === 100
  }

  // 生成唯一key
  const generateKey = () => `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // 根据项目编号查询项目信息
  const handleQueryByProjectCode = useCallback(async () => {
    if (!projectCode) {
      message.warning('请输入项目编号')
      return
    }

    // 避免重复请求
    if (querying) {
      return
    }

    setQuerying(true)
    try {
      // 使用统一的项目查询函数
      const result = await queryProjectByCode(projectCode)
      
      if (!result.success) {
        message.warning(result.message)
        return
      }

      if (result.projectInfo) {
        // 反显项目信息
        setProjectInfo({
          projectCode: result.projectInfo.projectCode,
          projectName: result.projectInfo.projectName,
          contractAmount: result.projectInfo.contractAmount,
          currentManpowerCost: result.projectInfo.currentManpowerCost,
          devopsProgress: result.projectInfo.taskProgress
        })
        
        form.setFieldsValue({
          projectCode: result.projectInfo.projectCode,
          projectName: result.projectInfo.projectName,
          contractAmount: result.projectInfo.contractAmount,
          currentManpowerCost: result.projectInfo.currentManpowerCost,
          taskProgress: result.projectInfo.taskProgress
        })
        
        // 保存项目ID
        setProjectId(result.projectInfo.projectId)
        
        // 尝试获取偏差记录中的任务进度
        try {
          const deviationResponse = await deviationApi.getResult(result.projectInfo.projectId)
          if (deviationResponse.data.code === 0 || deviationResponse.data.code === 200) {
            const deviationData = deviationResponse.data.data
            if (deviationData) {
              // 反显项目信息
              setProjectInfo(prev => ({
                ...prev,
                currentManpowerCost: deviationData.currentCostConsumption || prev.currentManpowerCost,
                devopsProgress: deviationData.taskProgress || prev.devopsProgress
              }))
              
              form.setFieldsValue({
                currentManpowerCost: deviationData.currentCostConsumption || result.projectInfo.currentManpowerCost,
                taskProgress: deviationData.taskProgress || result.projectInfo.taskProgress
              })
            }
          }
        } catch (error) {
          // 偏差记录不存在，忽略错误
        }
        
        // 反显人力成本明细（成员信息）
        if (result.members && Array.isArray(result.members)) {
          const membersList = result.members.map((member) => ({
            key: generateKey(),
            name: member.name || '',
            department: member.department || '',
            level: member.level || 'P5',
            dailyCost: member.dailyCost || 0,
            role: member.role || '开发',
            entryTime: member.entryTime ? dayjs(member.entryTime).format('YYYY-MM-DD') : '',
            leaveTime: member.leaveTime ? dayjs(member.leaveTime).format('YYYY-MM-DD') : '',
            reportedHours: member.reportedHours || 0
          }))
          setMembers(membersList)
        }
        
        message.success('项目信息已加载')
      }
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || '查询项目失败，请稍后重试'
      message.warning(errorMsg)
    } finally {
      setQuerying(false)
    }
  }, [projectCode, form])

  // 根据项目编号获取或创建项目
  const getOrCreateProject = async (projectCode: string) => {
    try {
      // 先尝试通过projectCode查询项目
      const response = await projectApi.getList({ keyword: projectCode })
      if (response.data.code === 0 || response.data.code === 200) {
        const projects = response.data.data || []
        const existingProject = projects.find((p: any) => p.projectCode === projectCode)
        if (existingProject) {
          return existingProject.id
        }
      }

      // 如果项目不存在，创建一个新项目
      const createResponse = await projectApi.create({
        projectCode,
        projectName: projectInfo.projectName || '未命名项目',
        contractAmount: projectInfo.contractAmount || 0,
        status: '进行中'
      })
      if (createResponse.data.code === 0 || createResponse.data.code === 200) {
        return createResponse.data.data.id
      }

      throw new Error('获取或创建项目失败')
    } catch (error) {
      console.error('获取或创建项目错误:', error)
      throw error
    }
  }

  // 保存人力成本明细
  const handleSaveManpowerCost = async () => {
    if (!projectInfo.projectCode) {
      message.warning('请先输入项目编号')
      return
    }

    try {
      const response = await deviationApi.saveManpowerCost({
        projectCode: projectInfo.projectCode,
        members: members.map(member => ({
          name: member.name,
          department: member.department,
          level: member.level,
          dailyCost: member.dailyCost,
          role: member.role,
          entryTime: member.entryTime,
          leaveTime: member.leaveTime,
          reportedHours: member.reportedHours
        }))
      })

      if (response.data.code === 0 || response.data.code === 200) {
        message.success('人力成本明细保存成功')
      } else {
        message.error(response.data.message || '保存失败')
      }
    } catch (error) {
      console.error('[Deviation] 保存人力成本明细错误:', error)
      message.error('保存失败，请重试')
    }
  }

  // 保存项目信息
  const handleSaveProjectInfo = async () => {
    if (!projectInfo.projectCode) {
      message.warning('请先输入项目编号')
      return
    }

    try {
      // 获取表单值
      const formValues = form.getFieldsValue()
      
      // 更新项目信息状态
      const updatedProjectInfo = {
        ...projectInfo,
        projectName: formValues.projectName || projectInfo.projectName,
        contractAmount: formValues.contractAmount || projectInfo.contractAmount,
        currentManpowerCost: formValues.currentManpowerCost || projectInfo.currentManpowerCost,
        devopsProgress: formValues.taskProgress || projectInfo.devopsProgress
      }
      
      setProjectInfo(updatedProjectInfo)

      // 获取或创建项目
      let currentProjectId = projectId
      if (!currentProjectId) {
        currentProjectId = await getOrCreateProject(updatedProjectInfo.projectCode)
        setProjectId(currentProjectId)
      }

      // 保存项目信息到偏差记录
      await deviationApi.updateProjectInfo(currentProjectId, {
        totalContractAmount: updatedProjectInfo.contractAmount,
        currentCostConsumption: updatedProjectInfo.currentManpowerCost,
        taskProgress: updatedProjectInfo.devopsProgress
      })

      message.success('项目信息保存成功')
    } catch (error) {
      console.error('[Deviation] 保存项目信息错误:', error)
      message.error('保存失败，请重试')
    }
  }

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
      width: 200,
      render: (value: string, record) => (
        <Select
          value={value || undefined}
          onChange={(v) => handleMemberChange(record.key, 'department', v)}
          options={departmentOptions}
          placeholder="请选择部门"
          style={{ width: '100%', borderRadius: 8 }}
          showSearch
          filterOption={(input, option) =>
            (option?.label || '').toLowerCase().includes(input.toLowerCase())
          }
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
      width: 100,
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
          {typeof value === 'number' ? value.toFixed(2) : '-'}
        </Tag>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (value: string, record) => (
        <Select
          value={value || undefined}
          onChange={(v) => handleMemberChange(record.key, 'role', v)}
          options={roleOptions}
          placeholder="请选择角色"
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

  // 开始分析 - 跳转到结果页面
  const handleStartAnalysis = async () => {
    if (!validateStageRatios()) {
      message.error('阶段比例合计必须为100%')
      return
    }

    if (!projectInfo.projectCode || !projectInfo.projectName || projectInfo.contractAmount === 0 || projectInfo.currentManpowerCost === undefined || projectInfo.devopsProgress === undefined) {
      message.error('请完善项目信息')
      return
    }
    
    if (projectInfo.devopsProgress === 0) {
      message.warning('DevOps进度为0，预期成本消耗将为0，请确认是否需要调整')
    }

    if (members.length === 0) {
      message.error('请添加项目成员')
      return
    }

    setAnalyzing(true)
    try {
      // 获取或创建项目
      let currentProjectId = projectId
      if (!currentProjectId) {
        currentProjectId = await getOrCreateProject(projectInfo.projectCode)
        setProjectId(currentProjectId)
      }

      // 保存项目信息到偏差记录
      await deviationApi.updateProjectInfo(currentProjectId, {
        totalContractAmount: projectInfo.contractAmount,
        currentCostConsumption: projectInfo.currentManpowerCost,
        taskProgress: projectInfo.devopsProgress
      })

      // 保存基准配置
      await deviationApi.saveBaseline(currentProjectId, {
        baselineType: baselineMode,
        expectedStages: baselineMode === 'default' ? stageRatios : undefined,
      })

      // 计算偏差
      const response = await deviationApi.calculateDeviation(currentProjectId)
      if (response.data.code === 0 || response.data.code === 200) {
        message.success('分析完成')
        // 跳转到结果页面
        window.location.href = `/cost-deviation/result?projectId=${currentProjectId}&expectedProfit=${expectedProfit}`
      }
    } catch (error) {
      console.error('分析错误:', error)
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
      {!recognizing && (
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
                  {typeof projectInfo.contractAmount === 'number' ? projectInfo.contractAmount.toFixed(2) : '-'} 万元
                </div>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small" style={{ borderRadius: 12, textAlign: 'center', background: '#F5F3FF', border: 'none' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>人力成本</Text>
                <div style={{ marginTop: 8, fontWeight: 600, color: '#5B21B6', fontSize: 16 }}>
                  {typeof projectInfo.currentManpowerCost === 'number' ? projectInfo.currentManpowerCost.toFixed(2) : '-'} 万元
                </div>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small" style={{ borderRadius: 12, textAlign: 'center', background: '#FFFBEB', border: 'none' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>DevOps进度</Text>
                <div style={{ marginTop: 8, fontWeight: 600, color: '#92400E', fontSize: 16 }}>
                  {typeof projectInfo.devopsProgress === 'number' ? projectInfo.devopsProgress.toFixed(1) : '-'} %
                </div>
              </Card>
            </Col>
          </Row>

          {/* 可编辑的项目信息表单 */}
          <Form form={form} layout="vertical" style={{ marginTop: 20 }}>
            <Row gutter={20}>
              <Col xs={24} md={6}>
                <Form.Item label="项目编号" name="projectCode">
                  <Input
                    value={projectCode}
                    onChange={(e) => setProjectCode(e.target.value)}
                    onBlur={() => {
                      if (projectCode.trim()) {
                        // 防抖处理，避免频繁请求
                        if (debounceTimerRef.current) {
                          clearTimeout(debounceTimerRef.current)
                        }
                        debounceTimerRef.current = setTimeout(() => {
                          handleQueryByProjectCode()
                        }, 1000) // 1秒防抖
                      }
                    }}
                    onPressEnter={() => {
                      if (projectCode.trim()) {
                        handleQueryByProjectCode()
                      }
                    }}
                    placeholder="请输入项目编号"
                    style={{ borderRadius: 8 }}
                    disabled={querying}
                  />
                </Form.Item>
              </Col>
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
              <Col xs={24} md={6} offset={18}>
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
            
            {/* 项目信息保存按钮 */}
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSaveProjectInfo}
                style={{ borderRadius: 8 }}
              >
                项目信息保存
              </Button>
            </div>
          </Form>
        </Card>
      )}

      {/* 人力成本明细模块 */}
      {!recognizing && (
        <Card
          style={{
            borderRadius: 16,
            marginBottom: 24,
            border: '1px solid var(--color-border-light)',
          }}
        >
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Title level={4} style={{ marginBottom: 4, fontWeight: 600 }}>
                <TeamOutlined style={{ marginRight: 10, color: '#F59E0B' }} />
                当前人力成本明细
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>管理项目团队成员信息，可新增、修改或删除成员</Text>
            </div>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSaveManpowerCost}
              style={{ borderRadius: 8 }}
            >
              保存人力成本明细
            </Button>
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
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <InputNumber
                value={expectedProfit}
                onChange={(value) => setExpectedProfit(value || 0)}
                min={0}
                max={50}
                precision={1}
                style={{ width: 150 }}
                addonAfter="%"
              />
              <Tooltip title="利润覆盖税率、外包采购、售前、硬件设备等成本">
                <InfoCircleOutlined style={{ color: '#64748b', marginLeft: 8 }} />
              </Tooltip>
            </div>
          </Form.Item>
        </Form>
      </Card>

      {/* 开始分析按钮 */}
      <Card style={{ borderRadius: 16, marginBottom: 24 }}>
        <Button
          type="primary"
          size="large"
          icon={<BarChartOutlined />}
          onClick={handleStartAnalysis}
          loading={analyzing}
          disabled={!projectInfo.projectCode || !projectInfo.projectName || projectInfo.contractAmount === 0 || projectInfo.currentManpowerCost === undefined || projectInfo.devopsProgress === undefined || !validateStageRatios() || members.length === 0}
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