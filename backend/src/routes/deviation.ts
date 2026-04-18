import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import prisma from '../config/database'
import dayjs from 'dayjs'
import { authMiddleware } from '../middlewares/auth'
import { decodeFilename } from '../utils/file'
import { sendSuccess as sendResponse, sendError } from '../utils/response'
import { verifyProjectOwnership } from '../utils/project'
import {
  ApiResponse,
  RecognizeResult,
  SaveBaselineRequest,
  CalculateDeviationRequest,
  DeviationResult,
  StageInfo,
  TeamCostInfo,
  AuthenticatedRequest
} from '../types'
import { aiService } from '../services/aiService'

const router = Router()

// ==================== 文件上传配置 ====================

const uploadDir = path.join(process.cwd(), 'uploads', 'screenshots')

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    // 解码文件名，修复中文乱码
    const decodedName = decodeFilename(file.originalname)
    file.originalname = decodedName
    const uniqueName = `${uuidv4()}${path.extname(decodedName)}`
    cb(null, uniqueName)
  }
})

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // 先解码文件名
    const decodedName = decodeFilename(file.originalname)
    file.originalname = decodedName
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp']
    const ext = path.extname(decodedName).toLowerCase()
    if (allowedExtensions.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('只支持图片格式文件'))
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
})

// ==================== 路由处理 ====================

/**
 * 真实 AI 识别 - 调用 Qwen/Qwen3-Omni-30B-A3B-Thinking 多模态模型
 */
const performAiRecognition = async (filePath: string, screenshotType: string): Promise<RecognizeResult> => {
  console.log(`[Deviation] 开始真实AI识别: ${filePath}, 类型: ${screenshotType}`)

  // 读取图片并转换为 base64
  const imageBuffer = fs.readFileSync(filePath)
  const imageBase64 = imageBuffer.toString('base64')

  // 调用 AI 服务的偏差截图识别方法
  const result = await aiService.recognizeProjectScreenshots([
    { type: screenshotType, base64: imageBase64 }
  ])

  // 转换为 RecognizeResult 格式
  return {
    totalContractAmount: result.contractAmount || 0,
    currentCostConsumption: result.currentManpowerCost || 0,
    taskProgress: result.taskProgress || 0,
    stageInfo: [
      { stage: '需求分析', ratio: 20, plannedProgress: 100, actualProgress: 100, plannedCost: 10, actualCost: 12 },
      { stage: '系统设计', ratio: 25, plannedProgress: 100, actualProgress: 90, plannedCost: 15, actualCost: 18 },
      { stage: '编码开发', ratio: 30, plannedProgress: 50, actualProgress: 40, plannedCost: 20, actualCost: 15 },
      { stage: '测试验证', ratio: 15, plannedProgress: 0, actualProgress: 0, plannedCost: 10, actualCost: 0 },
      { stage: '部署上线', ratio: 10, plannedProgress: 0, actualProgress: 0, plannedCost: 5, actualCost: 0 }
    ],
    members: result.members || [],
    projectName: result.projectName || '',
    rawText: '真实AI识别结果'
  }
}

/**
 * 计算成本偏差状态
 */
const getDeviationStatus = (deviation: number): 'normal' | 'warning' | 'critical' => {
  if (deviation <= 10) return 'normal'
  if (deviation <= 20) return 'warning'
  return 'critical'
}

/**
 * 生成 AI 建议
 */
const generateAiSuggestion = (
  deviation: number,
  stageInfo: StageInfo[],
  teamCosts: TeamCostInfo[]
): string => {
  // 计算整体超支/节约情况
  const isOverBudget = deviation > 0
  const absDeviation = Math.abs(deviation)
  
  // 找出核心问题阶段（偏差最大的阶段）
  const stageDeviations = stageInfo.map(stage => {
    if (stage.plannedCost && stage.actualCost) {
      return {
        stage: stage.stage,
        deviation: ((stage.actualCost - stage.plannedCost) / stage.plannedCost) * 100,
        isOverBudget: stage.actualCost > stage.plannedCost
      }
    }
    return { stage: stage.stage, deviation: 0, isOverBudget: false }
  })
  const problemStages = stageDeviations.filter(s => Math.abs(s.deviation) > 10).sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation))
  
  // 找出核心问题团队（偏差最大的团队）
  const problemTeams = teamCosts.filter(t => Math.abs(t.deviationRate) > 10).sort((a, b) => Math.abs(b.deviationRate) - Math.abs(a.deviationRate))
  
  // 构建AI建议输出
  const suggestions: string[] = []
  
  // 1. 整体成本偏差总结
  suggestions.push('【整体成本偏差总结】')
  if (isOverBudget) {
    suggestions.push(`整体成本超支${absDeviation.toFixed(1)}%，需要关注成本控制和资源调配。`)
  } else {
    suggestions.push(`整体成本节约${absDeviation.toFixed(1)}%，成本管控良好。`)
  }
  if (problemStages.length > 0) {
    suggestions.push(`核心问题阶段：${problemStages[0].stage}（偏差${problemStages[0].deviation.toFixed(1)}%${problemStages[0].isOverBudget ? '超支' : '节约'}）`)
  }
  if (problemTeams.length > 0) {
    suggestions.push(`核心问题团队：${problemTeams[0].team}（偏差${problemTeams[0].deviationRate.toFixed(1)}%）`)
  }
  suggestions.push('')
  
  // 2. 分阶段成本问题诊断
  suggestions.push('【分阶段成本问题诊断】')
  for (const stage of stageInfo) {
    if (stage.plannedCost && stage.actualCost) {
      const stageDeviation = ((stage.actualCost - stage.plannedCost) / stage.plannedCost) * 100
      const isOver = stage.actualCost > stage.plannedCost
      if (Math.abs(stageDeviation) > 5) {
        let reason = ''
        if (isOver) {
          reason = `成本偏高，可能原因：需求变更频繁、设计方案调整过多、开发工作量评估不足、测试轮次增加、部署问题等。`
        } else {
          reason = `成本偏低，可能原因：阶段工作量评估过高、资源利用率不足、进度延迟等。`
        }
        suggestions.push(`${stage.stage}阶段：${reason}当前偏差${stageDeviation.toFixed(1)}%。`)
      }
    }
  }
  suggestions.push('')
  
  // 3. 分团队成本问题诊断
  suggestions.push('【分团队成本问题诊断】')
  for (const team of teamCosts) {
    if (Math.abs(team.deviationRate) > 5) {
      const isOver = team.deviationRate > 0
      let reason = ''
      if (team.team.includes('产品')) {
        reason = isOver ? '可能原因：需求调研时间超出预期、需求变更频繁、产品方案调整较多。' : '可能原因：需求分析工作量评估过高、人员配置过剩。'
      } else if (team.team.includes('UI')) {
        reason = isOver ? '可能原因：UI设计轮次过多、界面改动频繁、设计方案反复调整。' : '可能原因：设计效率提升、设计复用率高、人员配置优化。'
      } else if (team.team.includes('研发')) {
        reason = isOver ? '可能原因：代码开发工作量超出预期、技术难题耗时、代码质量有问题导致返工、需求变更影响。' : '可能原因：开发效率提升、技术方案优化、复用代码增加。'
      } else if (team.team.includes('测试')) {
        reason = isOver ? '可能原因：测试用例执行轮次过多、bug修复返工、测试环境不稳定、回归测试工作量增加。' : '可能原因：测试效率提升、自动化测试覆盖率高、人员配置优化。'
      } else if (team.team.includes('项目管理')) {
        reason = isOver ? '可能原因：项目沟通协调工作量增加、进度管理成本上升、风险管理投入增加。' : '可能原因：项目管理效率提升、流程优化、人员配置合理。'
      }
      suggestions.push(`${team.team}：${reason}当前偏差${team.deviationRate.toFixed(1)}%。`)
    }
  }
  suggestions.push('')
  
  // 4. 人员调整与资源优化建议
  suggestions.push('【人员调整与资源优化建议】')
  suggestions.push('人员编制：')
  if (isOverBudget && absDeviation > 15) {
    suggestions.push('  - 评估各团队人员配置必要性，对冗余人员进行合理调配或优化')
    suggestions.push('  - 高偏差团队暂停新增人员招聘，结合自然离职进行缩编')
    suggestions.push('  - 考虑将部分非核心工作外包，降低固定人力成本')
  } else if (absDeviation < 5) {
    suggestions.push('  - 保持当前人员配置稳定，避免过度扩张')
    suggestions.push('  - 对于效率高的团队，可考虑适度扩充以提升整体产能')
  }
  suggestions.push('')
  suggestions.push('工作重心倾斜：')
  if (problemStages.length > 0) {
    suggestions.push(`  - 将优质资源向${problemStages[0].stage}阶段倾斜，优先解决核心瓶颈`)
    suggestions.push('  - 建立阶段成本预警机制，避免成本进一步超支')
  }
  if (problemTeams.length > 0) {
    suggestions.push(`  - 重点关注${problemTeams[0].team}团队，分析超支根因并制定改进措施`)
  }
  suggestions.push('')
  suggestions.push('分工优化：')
  suggestions.push('  - 减少跨团队沟通成本，明确职责边界')
  suggestions.push('  - 提升代码/设计复用率，避免重复造轮子')
  suggestions.push('  - 合并相似职责岗位，提升人效')
  suggestions.push('')
  suggestions.push('效率改进：')
  suggestions.push('  - 引入自动化工具提升研发、测试效率')
  suggestions.push('  - 优化开发流程，减少不必要的审批和等待环节')
  suggestions.push('  - 对于紧急任务可采用加班策略，长期任务考虑外包')
  suggestions.push('')
  suggestions.push('风险控制：')
  suggestions.push('  - 建立每日/每周成本监控机制，及时发现异常')
  suggestions.push('  - 预留应急预算应对后续阶段可能的风险')
  suggestions.push('  - 加强需求变更评审，避免频繁变更导致的成本增加')
  suggestions.push('')
  
  // 5. 短期+中长期执行方案
  suggestions.push('【短期+中长期执行方案】')
  suggestions.push('立即执行（1周内）：')
  suggestions.push('  - 召开成本分析会议，明确各团队超支原因')
  suggestions.push('  - 暂停非必要新增需求，冻结部分预算')
  suggestions.push('  - 制定紧急成本控制措施，设置成本上限')
  suggestions.push('')
  suggestions.push('阶段执行（当前里程碑内）：')
  suggestions.push('  - 每周监控成本消耗情况，设置偏差预警线')
  suggestions.push('  - 优化高偏差阶段的资源配置和工作流程')
  suggestions.push('  - 定期回顾成本偏差，及时调整策略')
  suggestions.push('')
  suggestions.push('长期优化（项目全周期）：')
  suggestions.push('  - 建立完善的项目成本估算体系')
  suggestions.push('  - 制定成本绩效考核机制，将成本控制与团队绩效挂钩')
  suggestions.push('  - 积累成本数据，为后续项目提供参考')
  suggestions.push('  - 持续优化开发、测试流程，提升整体人效')
  
  return suggestions.join('\n')
}

/**
 * 计算团队成本偏差
 */
const calculateTeamCosts = (
  expectedStages: StageInfo[],
  actualStages: StageInfo[],
  stageCosts: Record<string, number>,
  roleCosts: Record<string, number>,
  expectedCostConsumption: number
): TeamCostInfo[] => {
  // 计算各阶段预期成本
  const expectedStageCosts: Record<string, number> = {
    '需求': expectedCostConsumption * 0.15, // 15%
    '设计': expectedCostConsumption * 0.2,  // 20%
    '开发': expectedCostConsumption * 0.35,  // 35%
    '技术测试': expectedCostConsumption * 0.15, // 15%
    '性能测试': expectedCostConsumption * 0.05, // 5%
    '投产': expectedCostConsumption * 0.1   // 10%
  }

  const teams = [
    { 
      name: '产品团队', 
      expectedFormula: (sCosts: Record<string, number>) => sCosts['需求'] || 0,
      actualFormula: (rCosts: Record<string, number>) => rCosts['产品经理'] || 0
    },
    { 
      name: 'UI团队', 
      expectedFormula: (sCosts: Record<string, number>) => (sCosts['设计'] || 0) * 0.5,
      actualFormula: (rCosts: Record<string, number>) => rCosts['UI设计'] || 0
    },
    { 
      name: '研发团队', 
      expectedFormula: (sCosts: Record<string, number>) => (sCosts['设计'] || 0) * 0.5 + (sCosts['开发'] || 0),
      actualFormula: (rCosts: Record<string, number>) => (rCosts['开发工程师'] || 0) + (rCosts['技术经理'] || 0)
    },
    { 
      name: '测试团队', 
      expectedFormula: (sCosts: Record<string, number>) => (sCosts['技术测试'] || 0) + (sCosts['性能测试'] || 0),
      actualFormula: (rCosts: Record<string, number>) => rCosts['测试工程师'] || 0
    },
    { 
      name: '项目管理团队', 
      expectedFormula: (sCosts: Record<string, number>) => sCosts['投产'] || 0,
      actualFormula: (rCosts: Record<string, number>) => (rCosts['项目经理'] || 0) + (rCosts['项目负责人'] || 0)
    }
  ]

  return teams.map(team => {
    const plannedCost = team.expectedFormula(expectedStageCosts)
    const actualCost = team.actualFormula(roleCosts)
    const deviation = actualCost - plannedCost
    const deviationRate = plannedCost > 0 ? (deviation / plannedCost) * 100 : 0

    return {
      team: team.name,
      plannedCost,
      actualCost,
      deviation,
      deviationRate
    }
  })
}

// ==================== 默认基准配置 ====================

const DEFAULT_EXPECTED_STAGES: StageInfo[] = [
  { stage: '需求分析', ratio: 15, plannedProgress: 100, actualProgress: 0, plannedCost: 15 },
  { stage: '系统设计', ratio: 20, plannedProgress: 100, actualProgress: 0, plannedCost: 20 },
  { stage: '编码开发', ratio: 35, plannedProgress: 100, actualProgress: 0, plannedCost: 35 },
  { stage: '测试验证', ratio: 15, plannedProgress: 100, actualProgress: 0, plannedCost: 15 },
  { stage: '部署上线', ratio: 10, plannedProgress: 100, actualProgress: 0, plannedCost: 10 },
  { stage: '运维支持', ratio: 5, plannedProgress: 100, actualProgress: 0, plannedCost: 5 }
]

// ==================== 路由定义 ====================

/**
 * POST /upload - 上传项目截图（支持多张图片）
 */
router.post('/upload', authMiddleware, upload.array('images', 20), async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const userId = authReq.userId
    const files = req.files as Express.Multer.File[]

    if (!files || files.length === 0) {
      return sendError(res, 400, '请上传截图文件')
    }

    console.log(`[Deviation] 上传了 ${files.length} 张截图`)

    // 创建项目
    const project = await prisma.project.create({
      data: {
        userId,
        projectName: `偏差分析项目_${dayjs().format('YYYYMMDD')}`,
        projectType: 'software',
        status: 'ongoing'
      }
    })

    // 创建项目专属截图目录
    const projectScreenshotsDir = path.join(uploadDir, String(project.id))
    if (!fs.existsSync(projectScreenshotsDir)) {
      fs.mkdirSync(projectScreenshotsDir, { recursive: true })
    }

    // 将上传的截图移动到项目专属目录
    for (const file of files) {
      const srcPath = path.join(uploadDir, file.filename)
      const destPath = path.join(projectScreenshotsDir, file.filename)
      if (fs.existsSync(srcPath)) {
        fs.renameSync(srcPath, destPath)
      }
    }

    // 创建初始偏差记录
    await prisma.costDeviation.create({
      data: {
        projectId: project.id,
        totalContractAmount: 0,
        currentCostConsumption: 0,
        taskProgress: 0,
        costDeviation: 0,
        baselineType: 'default',
        expectedStages: JSON.stringify(DEFAULT_EXPECTED_STAGES),
        actualStages: JSON.stringify([])
      }
    })

    sendResponse(res, {
      projectId: project.id,
      uploadedCount: files.length,
      filePath: `/uploads/screenshots/${project.id}`
    }, '截图上传成功')
  } catch (error) {
    console.error('Upload error:', error)
    sendError(res, 500, '截图上传失败')
  }
})

/**
 * POST /:projectId/recognize - 真实 AI 识别
 */
router.post('/:projectId/recognize', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const { projectId } = req.params
    const userId = authReq.userId

    if (!await verifyProjectOwnership(Number(projectId), userId)) {
      return sendError(res, 403, '无权访问该项目')
    }

    console.log(`[Deviation] 开始AI识别，项目ID: ${projectId}`)

    // 获取该项目上传的所有截图
    const projectScreenshotsDir = path.join(uploadDir, String(projectId))
    let screenshots: { type: string; path: string }[] = []

    // 检查项目专属目录
    if (fs.existsSync(projectScreenshotsDir)) {
      const files = fs.readdirSync(projectScreenshotsDir)
      screenshots = files.map(f => ({
        type: path.extname(f).replace('.', ''),
        path: path.join(projectScreenshotsDir, f)
      }))
    }

    // 如果项目专属目录没有文件，从上传目录获取最新文件
    if (screenshots.length === 0) {
      const files = fs.readdirSync(uploadDir)
      const latestFiles = files.slice(-4) // 取最新的4个文件
      screenshots = latestFiles.map(f => ({
        type: f.split('_')[0] || 'unknown', // 从文件名推断类型
        path: path.join(uploadDir, f)
      }))
    }

    if (screenshots.length === 0) {
      return sendError(res, 400, '请先上传项目截图')
    }

    // 真实 AI 识别 - 对每张截图进行识别并合并结果
    let combinedResult: RecognizeResult = {
      totalContractAmount: 0,
      currentCostConsumption: 0,
      taskProgress: 0,
      stageInfo: DEFAULT_EXPECTED_STAGES,
      rawText: ''
    }

    for (const screenshot of screenshots) {
      console.log(`[Deviation] 正在识别截图: ${screenshot.path}`)
      const result = await performAiRecognition(screenshot.path, screenshot.type)
      // 合并结果，优先使用非零值
      if (result.totalContractAmount > 0 && combinedResult.totalContractAmount === 0) {
        combinedResult.totalContractAmount = result.totalContractAmount
      }
      if (result.currentCostConsumption > 0 && combinedResult.currentCostConsumption === 0) {
        combinedResult.currentCostConsumption = result.currentCostConsumption
      }
      if (result.taskProgress > 0 && combinedResult.taskProgress === 0) {
        combinedResult.taskProgress = result.taskProgress
      }
      combinedResult.rawText += result.rawText + '\n'
    }

    console.log(`[Deviation] AI识别完成: 合同金额=${combinedResult.totalContractAmount}, 成本=${combinedResult.currentCostConsumption}, 进度=${combinedResult.taskProgress}%`)

    // 更新偏差记录
    const deviation = await prisma.costDeviation.findFirst({
      where: { projectId: Number(projectId) }
    })

    if (deviation) {
      await prisma.costDeviation.update({
        where: { id: deviation.id },
        data: {
          totalContractAmount: combinedResult.totalContractAmount,
          currentCostConsumption: combinedResult.currentCostConsumption,
          taskProgress: combinedResult.taskProgress,
          actualStages: JSON.stringify(combinedResult.stageInfo)
        }
      })
    }

    const response: RecognizeResult = combinedResult

    sendResponse(res, response, 'AI识别成功')
  } catch (error) {
    console.error('Recognize error:', error)
    sendError(res, 500, 'AI识别失败')
  }
})

/**
 * POST /:projectId/baseline - 保存分析基准
 */
router.post('/:projectId/baseline', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const { projectId } = req.params
    const userId = authReq.userId
    const data: SaveBaselineRequest = req.body

    if (!await verifyProjectOwnership(Number(projectId), userId)) {
      return sendError(res, 403, '无权访问该项目')
    }

    let deviation = await prisma.costDeviation.findFirst({
      where: { projectId: Number(projectId) }
    })

    // 如果没有偏差记录，创建一个新的
    if (!deviation) {
      deviation = await prisma.costDeviation.create({
        data: {
          projectId: Number(projectId),
          totalContractAmount: 0,
          currentCostConsumption: 0,
          taskProgress: 0,
          baselineType: 'default',
          expectedStages: JSON.stringify(DEFAULT_EXPECTED_STAGES),
          actualStages: JSON.stringify(DEFAULT_EXPECTED_STAGES)
        }
      })
    }

    // 更新基准配置
    const expectedStages = data.expectedStages || DEFAULT_EXPECTED_STAGES

    await prisma.costDeviation.update({
      where: { id: deviation.id },
      data: {
        baselineType: data.baselineType,
        baselineConfig: data.baselineConfig ? JSON.stringify(data.baselineConfig) : null,
        expectedStages: JSON.stringify(expectedStages)
      }
    })

    sendResponse(res, { baselineType: data.baselineType }, '基准保存成功')
  } catch (error) {
    console.error('Save baseline error:', error)
    sendError(res, 500, '基准保存失败')
  }
})

/**
 * 计算各角色成本和阶段成本
 */
const calculateStageCosts = async (projectId: number): Promise<{ stageCosts: Record<string, number>; totalCost: number; roleCosts: Record<string, number> }> => {
  // 获取项目成员
  const members = await prisma.projectMember.findMany({
    where: { projectId }
  })

  // 定义角色单价映射（根据CODE_REVIEW_REPORT.md中的正确值）
  const dailyCostMap: Record<string, number> = {
    'P3': 0.08,
    'P4': 0.11,
    'P5': 0.16,
    'P6': 0.21,
    'P7': 0.26,
    'P8': 0.36
  }

  // 计算各角色成本
  const roleCosts: Record<string, number> = {
    '产品经理': 0,
    'UI设计': 0,
    '开发工程师': 0,
    '技术经理': 0,
    '测试工程师': 0,
    '项目经理': 0,
    '项目负责人': 0
  }

  for (const member of members) {
    const dailyCost = dailyCostMap[member.level] || 0.16 // 默认P5
    const reportedHours = member.reportedHours || 0
    const cost = (reportedHours / 8) * dailyCost
    
    switch (member.role) {
      case '产品经理':
        roleCosts['产品经理'] += cost
        break
      case 'UI设计':
        roleCosts['UI设计'] += cost
        break
      case '开发工程师':
        roleCosts['开发工程师'] += cost
        break
      case '技术经理':
        roleCosts['技术经理'] += cost
        break
      case '测试工程师':
        roleCosts['测试工程师'] += cost
        break
      case '项目经理':
        roleCosts['项目经理'] += cost
        break
      case '项目负责人':
        roleCosts['项目负责人'] += cost
        break
      default:
        // 默认为开发工程师
        roleCosts['开发工程师'] += cost
        break
    }
  }

  // 计算各阶段成本（按照新公式）
  const stageCosts: Record<string, number> = {
    '需求': roleCosts['产品经理'],
    '设计': roleCosts['UI设计'] + (roleCosts['开发工程师'] + roleCosts['技术经理']) * 0.3,
    '开发': (roleCosts['开发工程师'] + roleCosts['技术经理']) * 0.7,
    '技术测试': roleCosts['测试工程师'] * 0.7,
    '性能测试': roleCosts['测试工程师'] * 0.3,
    '投产': roleCosts['项目经理'] + roleCosts['项目负责人']
  }

  // 计算总实际成本
  const totalCost = Object.values(stageCosts).reduce((sum, cost) => sum + cost, 0)

  return { stageCosts, totalCost, roleCosts }
}

/**
 * POST /:projectId/calculate - 计算偏差
 */
router.post('/:projectId/calculate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const { projectId } = req.params
    const userId = authReq.userId
    const data: CalculateDeviationRequest = req.body

    if (!await verifyProjectOwnership(Number(projectId), userId)) {
      return sendError(res, 403, '无权访问该项目')
    }

    let deviation = await prisma.costDeviation.findFirst({
      where: { projectId: Number(projectId) }
    })

    // 如果没有偏差记录，创建一个新的
    if (!deviation) {
      deviation = await prisma.costDeviation.create({
        data: {
          projectId: Number(projectId),
          totalContractAmount: 0,
          currentCostConsumption: 0,
          taskProgress: 0,
          baselineType: 'default',
          expectedStages: JSON.stringify(DEFAULT_EXPECTED_STAGES),
          actualStages: JSON.stringify(DEFAULT_EXPECTED_STAGES)
        }
      })
    }

    // 计算各阶段实际成本
    const { stageCosts, totalCost, roleCosts } = await calculateStageCosts(Number(projectId))

    // 更新实际成本消耗
    await prisma.costDeviation.update({
      where: { id: deviation.id },
      data: {
        currentCostConsumption: totalCost
      }
    })

    // 重新获取偏差记录
    deviation = await prisma.costDeviation.findFirst({
      where: { projectId: Number(projectId) }
    })

    if (!deviation) {
      sendError(res, 404, '项目偏差数据不存在')
      return
    }

    // 计算预期成本（合同总金额去掉利润空间后，按照系统默认比例计算）
    const profitMargin = 0.20 // 默认20%利润空间
    const expectedTotalCost = deviation.totalContractAmount * (1 - profitMargin)
    const expectedCostConsumption = expectedTotalCost * (deviation.taskProgress / 100)

    // 构建实际阶段数据，使用新的阶段名称
    const actualStages: StageInfo[] = [
      {
        stage: '需求',
        ratio: 15,
        plannedProgress: 100,
        actualProgress: deviation.taskProgress,
        plannedCost: expectedCostConsumption * 0.15,
        actualCost: stageCosts['需求'] || 0
      },
      {
        stage: '设计',
        ratio: 20,
        plannedProgress: 100,
        actualProgress: deviation.taskProgress,
        plannedCost: expectedCostConsumption * 0.20,
        actualCost: stageCosts['设计'] || 0
      },
      {
        stage: '开发',
        ratio: 35,
        plannedProgress: 100,
        actualProgress: deviation.taskProgress,
        plannedCost: expectedCostConsumption * 0.35,
        actualCost: stageCosts['开发'] || 0
      },
      {
        stage: '技术测试',
        ratio: 15,
        plannedProgress: 100,
        actualProgress: deviation.taskProgress,
        plannedCost: expectedCostConsumption * 0.15,
        actualCost: stageCosts['技术测试'] || 0
      },
      {
        stage: '性能测试',
        ratio: 5,
        plannedProgress: 100,
        actualProgress: deviation.taskProgress,
        plannedCost: expectedCostConsumption * 0.05,
        actualCost: stageCosts['性能测试'] || 0
      },
      {
        stage: '投产',
        ratio: 10,
        plannedProgress: 100,
        actualProgress: deviation.taskProgress,
        plannedCost: expectedCostConsumption * 0.10,
        actualCost: stageCosts['投产'] || 0
      }
    ]

    // 构建预期阶段数据，使用新的阶段名称
    const expectedStages: StageInfo[] = [
      {
        stage: '需求',
        ratio: 15,
        plannedProgress: 100,
        actualProgress: 0,
        plannedCost: expectedCostConsumption * 0.15
      },
      {
        stage: '设计',
        ratio: 20,
        plannedProgress: 100,
        actualProgress: 0,
        plannedCost: expectedCostConsumption * 0.20
      },
      {
        stage: '开发',
        ratio: 35,
        plannedProgress: 100,
        actualProgress: 0,
        plannedCost: expectedCostConsumption * 0.35
      },
      {
        stage: '技术测试',
        ratio: 15,
        plannedProgress: 100,
        actualProgress: 0,
        plannedCost: expectedCostConsumption * 0.15
      },
      {
        stage: '性能测试',
        ratio: 5,
        plannedProgress: 100,
        actualProgress: 0,
        plannedCost: expectedCostConsumption * 0.05
      },
      {
        stage: '投产',
        ratio: 10,
        plannedProgress: 100,
        actualProgress: 0,
        plannedCost: expectedCostConsumption * 0.10
      }
    ]

    // 计算成本偏差
    const costConsumptionRate = expectedTotalCost > 0
      ? (totalCost / expectedTotalCost) * 100
      : 0

    const costDeviation = costConsumptionRate - deviation.taskProgress

    // 打印成本消耗率和成本偏差率，便于调试
    console.log(`[Deviation] 项目ID: ${projectId}`);
    console.log(`[Deviation] 合同金额: ${deviation.totalContractAmount}万元`);
    console.log(`[Deviation] 当前成本消耗: ${totalCost}万元`);
    console.log(`[Deviation] 预期成本: ${expectedCostConsumption}万元`);
    console.log(`[Deviation] 任务进度: ${deviation.taskProgress}%`);
    console.log(`[Deviation] 成本消耗率: ${costConsumptionRate.toFixed(2)}%`);
    console.log(`[Deviation] 成本偏差率: ${costDeviation.toFixed(2)}%`);
    console.log(`[Deviation] 各阶段实际成本:`, stageCosts);
    console.log(`[Deviation] 各角色成本:`, roleCosts);

    // 计算团队成本偏差
    const teamCosts = calculateTeamCosts(expectedStages, actualStages, stageCosts, roleCosts, expectedCostConsumption)

    // 生成AI建议
    const aiSuggestion = generateAiSuggestion(costDeviation, actualStages, teamCosts)

    // 更新偏差记录
    await prisma.costDeviation.update({
      where: { id: deviation.id },
      data: {
        costDeviation,
        teamCosts: JSON.stringify(teamCosts),
        aiSuggestion,
        actualStages: JSON.stringify(actualStages)
      }
    })

    const deviationStatus = getDeviationStatus(Math.abs(costDeviation))

    const response: DeviationResult = {
      totalContractAmount: deviation.totalContractAmount,
      currentCostConsumption: totalCost,
      expectedCostConsumption: expectedCostConsumption,
      taskProgress: deviation.taskProgress,
      costDeviation,
      deviationRate: costDeviation,
      deviationStatus,
      baselineType: deviation.baselineType,
      expectedStages,
      actualStages,
      stageDetails: expectedStages.map((stage) => {
        const actualStage = actualStages.find(s => s.stage === stage.stage) || stage
        const expectedCost = expectedCostConsumption * (stage.ratio / 100)
        const actualCost = actualStage.actualCost || 0
        const stageDeviation = expectedCost > 0 ? ((actualCost - expectedCost) / expectedCost) * 100 : 0
        return {
          stage: stage.stage,
          expected: expectedCost,
          actual: actualCost,
          deviation: stageDeviation
        }
      }),
      teamCosts,
      aiSuggestion
    }

    sendResponse(res, response, '偏差计算成功')
  } catch (error) {
    console.error('Calculate deviation error:', error)
    sendError(res, 500, '偏差计算失败')
  }
})

/**
 * GET /:projectId/suggestion - 获取AI建议
 */
router.get('/:projectId/suggestion', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const { projectId } = req.params
    const userId = authReq.userId

    if (!await verifyProjectOwnership(Number(projectId), userId)) {
      return sendError(res, 403, '无权访问该项目')
    }

    let deviation = await prisma.costDeviation.findFirst({
      where: { projectId: Number(projectId) }
    })

    // 如果没有偏差记录，创建一个新的
    if (!deviation) {
      deviation = await prisma.costDeviation.create({
        data: {
          projectId: Number(projectId),
          totalContractAmount: 0,
          currentCostConsumption: 0,
          taskProgress: 0,
          baselineType: 'default',
          expectedStages: JSON.stringify(DEFAULT_EXPECTED_STAGES),
          actualStages: JSON.stringify(DEFAULT_EXPECTED_STAGES)
        }
      })
    }

    // 如果没有AI建议，生成一份
    let aiSuggestion = deviation.aiSuggestion

    if (!aiSuggestion) {
      const expectedStages: StageInfo[] = JSON.parse(deviation.expectedStages || '[]')
      const actualStages: StageInfo[] = JSON.parse(deviation.actualStages || '[]')
      const teamCosts: TeamCostInfo[] = JSON.parse(deviation.teamCosts || '[]')

      aiSuggestion = generateAiSuggestion(deviation.costDeviation, actualStages, teamCosts)

      // 更新记录
      await prisma.costDeviation.update({
        where: { id: deviation.id },
        data: { aiSuggestion }
      })
    }

    sendResponse(res, { suggestion: aiSuggestion }, '获取AI建议成功')
  } catch (error) {
    console.error('Get suggestion error:', error)
    sendError(res, 500, '获取AI建议失败')
  }
})

/**
 * GET /:projectId/result - 获取分析结果
 */
router.get('/:projectId/result', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const { projectId } = req.params
    const userId = authReq.userId

    if (!await verifyProjectOwnership(Number(projectId), userId)) {
      return sendError(res, 403, '无权访问该项目')
    }

    let deviation = await prisma.costDeviation.findFirst({
      where: { projectId: Number(projectId) }
    })

    if (!deviation) {
      return sendError(res, 404, '未找到偏差分析结果')
    }

    // 计算各阶段实际成本
    const { stageCosts, totalCost, roleCosts } = await calculateStageCosts(Number(projectId))

    // 更新实际成本消耗
    if (totalCost !== deviation.currentCostConsumption) {
      await prisma.costDeviation.update({
        where: { id: deviation.id },
        data: {
          currentCostConsumption: totalCost
        }
      })
      // 重新获取偏差记录
      deviation = await prisma.costDeviation.findFirst({
        where: { projectId: Number(projectId) }
      })

      if (!deviation) {
        sendError(res, 404, '项目偏差数据不存在')
        return
      }
    }

    // 计算预期成本（合同总金额去掉利润空间后，按照系统默认比例计算）
    const profitMargin = 0.20 // 默认20%利润空间
    const expectedTotalCost = deviation.totalContractAmount * (1 - profitMargin)
    const expectedCostConsumption = expectedTotalCost * (deviation.taskProgress / 100)

    // 构建实际阶段数据，使用新的阶段名称
    const actualStages: StageInfo[] = [
      {
        stage: '需求',
        ratio: 15,
        plannedProgress: 100,
        actualProgress: deviation.taskProgress,
        plannedCost: expectedCostConsumption * 0.15,
        actualCost: stageCosts['需求'] || 0
      },
      {
        stage: '设计',
        ratio: 20,
        plannedProgress: 100,
        actualProgress: deviation.taskProgress,
        plannedCost: expectedCostConsumption * 0.20,
        actualCost: stageCosts['设计'] || 0
      },
      {
        stage: '开发',
        ratio: 35,
        plannedProgress: 100,
        actualProgress: deviation.taskProgress,
        plannedCost: expectedCostConsumption * 0.35,
        actualCost: stageCosts['开发'] || 0
      },
      {
        stage: '技术测试',
        ratio: 15,
        plannedProgress: 100,
        actualProgress: deviation.taskProgress,
        plannedCost: expectedCostConsumption * 0.15,
        actualCost: stageCosts['技术测试'] || 0
      },
      {
        stage: '性能测试',
        ratio: 5,
        plannedProgress: 100,
        actualProgress: deviation.taskProgress,
        plannedCost: expectedCostConsumption * 0.05,
        actualCost: stageCosts['性能测试'] || 0
      },
      {
        stage: '投产',
        ratio: 10,
        plannedProgress: 100,
        actualProgress: deviation.taskProgress,
        plannedCost: expectedCostConsumption * 0.10,
        actualCost: stageCosts['投产'] || 0
      }
    ]

    // 构建预期阶段数据，使用新的阶段名称
    const expectedStages: StageInfo[] = [
      {
        stage: '需求',
        ratio: 15,
        plannedProgress: 100,
        actualProgress: 0,
        plannedCost: expectedCostConsumption * 0.15
      },
      {
        stage: '设计',
        ratio: 20,
        plannedProgress: 100,
        actualProgress: 0,
        plannedCost: expectedCostConsumption * 0.20
      },
      {
        stage: '开发',
        ratio: 35,
        plannedProgress: 100,
        actualProgress: 0,
        plannedCost: expectedCostConsumption * 0.35
      },
      {
        stage: '技术测试',
        ratio: 15,
        plannedProgress: 100,
        actualProgress: 0,
        plannedCost: expectedCostConsumption * 0.15
      },
      {
        stage: '性能测试',
        ratio: 5,
        plannedProgress: 100,
        actualProgress: 0,
        plannedCost: expectedCostConsumption * 0.05
      },
      {
        stage: '投产',
        ratio: 10,
        plannedProgress: 100,
        actualProgress: 0,
        plannedCost: expectedCostConsumption * 0.10
      }
    ]

    // 计算成本偏差
    const costConsumptionRate = expectedTotalCost > 0
      ? (totalCost / expectedTotalCost) * 100
      : 0

    const costDeviation = costConsumptionRate - deviation.taskProgress

    // 计算团队成本偏差
    const teamCosts = calculateTeamCosts(expectedStages, actualStages, stageCosts, roleCosts, expectedCostConsumption)

    // 生成AI建议
    const aiSuggestion = generateAiSuggestion(costDeviation, actualStages, teamCosts)

    // 更新偏差记录
    await prisma.costDeviation.update({
      where: { id: deviation.id },
      data: {
        costDeviation,
        teamCosts: JSON.stringify(teamCosts),
        aiSuggestion,
        actualStages: JSON.stringify(actualStages)
      }
    })

    const deviationStatus = getDeviationStatus(Math.abs(costDeviation))

    const response: DeviationResult = {
      totalContractAmount: deviation.totalContractAmount,
      currentCostConsumption: totalCost,
      expectedCostConsumption: expectedCostConsumption,
      taskProgress: deviation.taskProgress,
      costDeviation,
      deviationRate: costDeviation,
      deviationStatus,
      baselineType: deviation.baselineType,
      expectedStages,
      actualStages,
      stageDetails: expectedStages.map((stage) => {
        const actualStage = actualStages.find(s => s.stage === stage.stage) || stage
        const expectedCost = expectedCostConsumption * (stage.ratio / 100)
        const actualCost = actualStage.actualCost || 0
        const stageDeviation = expectedCost > 0 ? ((actualCost - expectedCost) / expectedCost) * 100 : 0
        return {
          stage: stage.stage,
          expected: expectedCost,
          actual: actualCost,
          deviation: stageDeviation
        }
      }),
      teamCosts,
      aiSuggestion
    }

    sendResponse(res, response, '获取分析结果成功')
  } catch (error) {
    console.error('Get result error:', error)
    sendError(res, 500, '获取分析结果失败')
  }
})

/**
 * GET /:projectId/export - 导出分析报告
 */
router.get('/:projectId/export', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const { projectId } = req.params
    const userId = authReq.userId

    if (!await verifyProjectOwnership(Number(projectId), userId)) {
      return sendError(res, 403, '无权访问该项目')
    }

    const project = await prisma.project.findUnique({
      where: { id: Number(projectId) }
    })

    const deviation = await prisma.costDeviation.findFirst({
      where: { projectId: Number(projectId) }
    })

    if (!deviation || !project) {
      return sendError(res, 404, '未找到偏差分析结果')
    }

    const expectedStages: StageInfo[] = JSON.parse(deviation.expectedStages || '[]')
    const actualStages: StageInfo[] = JSON.parse(deviation.actualStages || '[]')
    const teamCosts: TeamCostInfo[] = JSON.parse(deviation.teamCosts || '[]')
    const deviationStatus = getDeviationStatus(Math.abs(deviation.costDeviation))

    // 导出目录
    const exportDir = path.join(process.cwd(), 'uploads', 'exports')
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true })
    }

    const fileName = `deviation_${project.projectName}_${Date.now()}.xlsx`
    const filePath = path.join(exportDir, fileName)

    // 创建 Excel 文件
    const xlsx = await import('xlsx')
    const wb = xlsx.utils.book_new()

    // 概览页
    const summaryData = [
      ['项目名称', project.projectName],
      ['合同总金额（万元）', deviation.totalContractAmount],
      ['当前成本消耗（万元）', deviation.currentCostConsumption],
      ['任务进度（%）', deviation.taskProgress],
      ['成本偏差（%）', deviation.costDeviation],
      ['偏差状态', deviationStatus],
      ['分析时间', deviation.createdAt.toLocaleString()]
    ]
    const summaryWs = xlsx.utils.aoa_to_sheet(summaryData)
    xlsx.utils.book_append_sheet(wb, summaryWs, '概览')

    // 阶段对比页
    const stageData = [['阶段', '计划进度', '实际进度', '计划成本', '实际成本', '偏差']]
    expectedStages.forEach((expected, index) => {
      const actual = actualStages.find(a => a.stage === expected.stage) || expected
      const progressDiff = (actual.actualProgress || 0) - (expected.plannedProgress || 0)
      const costDiff = (actual.actualCost || 0) - (expected.plannedCost || 0)
      stageData.push([
        expected.stage,
        String(expected.plannedProgress || 0),
        String(actual.actualProgress || 0),
        String(expected.plannedCost || 0),
        String(actual.actualCost || 0),
        String(costDiff)
      ])
    })
    const stageWs = xlsx.utils.aoa_to_sheet(stageData)
    xlsx.utils.book_append_sheet(wb, stageWs, '阶段对比')

    // 团队成本页
    const teamData = [['团队', '计划成本', '实际成本', '偏差', '偏差率（%）']]
    teamCosts.forEach(team => {
      teamData.push([team.team, String(team.plannedCost), String(team.actualCost), String(team.deviation), String(team.deviationRate)])
    })
    const teamWs = xlsx.utils.aoa_to_sheet(teamData)
    xlsx.utils.book_append_sheet(wb, teamWs, '团队成本')

    // AI建议页
    if (deviation.aiSuggestion) {
      const suggestionData = [['AI分析与建议'], [deviation.aiSuggestion]]
      const suggestionWs = xlsx.utils.aoa_to_sheet(suggestionData)
      xlsx.utils.book_append_sheet(wb, suggestionWs, 'AI建议')
    }

    // 写入文件
    xlsx.writeFile(wb, filePath)

    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Download error:', err)
      }
    })
  } catch (error) {
    console.error('Export error:', error)
    sendError(res, 500, '导出报告失败')
  }
})

/**
 * POST /save-manpower-cost - 保存人力成本明细
 */
router.post('/save-manpower-cost', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { projectCode, members } = req.body

    if (!projectCode) {
      return sendError(res, 400, '项目编号不能为空')
    }

    // 查找项目
    const project = await prisma.project.findFirst({
      where: { projectCode }
    })

    if (!project) {
      return sendError(res, 404, '项目不存在')
    }

    // 保存成员信息
    if (members && Array.isArray(members)) {
      // 先删除原有成员
      await prisma.projectMember.deleteMany({
        where: { projectId: project.id }
      })

      // 保存新成员
      for (const member of members) {
        await prisma.projectMember.create({
          data: {
            projectId: project.id,
            name: member.name,
            department: member.department || null,
            level: member.level,
            dailyCost: member.dailyCost,
            role: member.role,
            entryTime: member.entryTime ? new Date(member.entryTime) : null,
            leaveTime: member.leaveTime ? new Date(member.leaveTime) : null,
            reportedHours: member.reportedHours
          }
        })
      }
    }

    sendResponse(res, { success: true }, '人力成本明细保存成功')
  } catch (error) {
    console.error('Save manpower cost error:', error)
    sendError(res, 500, '保存人力成本明细失败')
  }
})

/**
 * PUT /:projectId/project-info - 更新项目信息到偏差记录
 */
router.put('/:projectId/project-info', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const { projectId } = req.params
    const userId = authReq.userId
    const { totalContractAmount, currentCostConsumption, taskProgress } = req.body

    if (!await verifyProjectOwnership(Number(projectId), userId)) {
      return sendError(res, 403, '无权访问该项目')
    }

    let deviation = await prisma.costDeviation.findFirst({
      where: { projectId: Number(projectId) }
    })

    // 如果没有偏差记录，创建一个新的
    if (!deviation) {
      deviation = await prisma.costDeviation.create({
        data: {
          projectId: Number(projectId),
          totalContractAmount: totalContractAmount || 0,
          currentCostConsumption: currentCostConsumption || 0,
          taskProgress: taskProgress || 0,
          baselineType: 'default',
          expectedStages: JSON.stringify(DEFAULT_EXPECTED_STAGES),
          actualStages: JSON.stringify(DEFAULT_EXPECTED_STAGES)
        }
      })
    } else {
      // 更新偏差记录
      await prisma.costDeviation.update({
        where: { id: deviation.id },
        data: {
          totalContractAmount: totalContractAmount || deviation.totalContractAmount,
          currentCostConsumption: currentCostConsumption || deviation.currentCostConsumption,
          taskProgress: taskProgress || deviation.taskProgress
        }
      })
    }

    sendResponse(res, { success: true }, '项目信息更新成功')
  } catch (error) {
    console.error('Update project info error:', error)
    sendError(res, 500, '项目信息更新失败')
  }
})

export default router