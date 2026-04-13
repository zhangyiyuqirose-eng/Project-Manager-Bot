import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import prisma from '../config/database'
import dayjs from 'dayjs'
import { authMiddleware } from '../middlewares/auth'
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

/**
 * 修复中文文件名乱码问题
 * multer 接收的 file.originalname 可能是 latin1 编码，需要转换为 utf8
 */
function decodeFilename(filename: string): string {
  try {
    // 尝试从 latin1 转换为 utf8
    const decoded = Buffer.from(filename, 'latin1').toString('utf8')
    // 如果解码后包含乱码特征，则返回原文件名
    if (decoded.includes('') || decoded.includes('')) {
      return filename
    }
    return decoded
  } catch {
    return filename
  }
}

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

// ==================== 辅助函数 ====================

const sendResponse = <T>(res: Response, data: T, message = '操作成功'): void => {
  res.json({
    code: 200,
    message,
    data
  })
}

const sendError = (res: Response, code: number, message: string): void => {
  res.status(code).json({
    code,
    message,
    data: null
  })
}

/**
 * 验证项目归属
 */
const verifyProjectOwnership = async (projectId: number, userId: number): Promise<boolean> => {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId }
  })
  return project !== null
}

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
      { name: '需求分析', plannedProgress: 100, actualProgress: 100, plannedCost: 10, actualCost: 12 },
      { name: '系统设计', plannedProgress: 100, actualProgress: 90, plannedCost: 15, actualCost: 18 },
      { name: '编码开发', plannedProgress: 50, actualProgress: 40, plannedCost: 20, actualCost: 15 },
      { name: '测试验证', plannedProgress: 0, actualProgress: 0, plannedCost: 10, actualCost: 0 },
      { name: '部署上线', plannedProgress: 0, actualProgress: 0, plannedCost: 5, actualCost: 0 }
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
  const suggestions: string[] = []

  if (deviation > 20) {
    suggestions.push('成本偏差严重，建议立即进行成本控制和资源调整。')
  } else if (deviation > 10) {
    suggestions.push('成本偏差较大，建议密切关注项目进度和资源消耗情况。')
  } else {
    suggestions.push('成本偏差在可控范围内，建议继续保持当前进度。')
  }

  // 分析各阶段偏差
  for (const stage of stageInfo) {
    if (stage.plannedCost && stage.actualCost) {
      const stageDeviation = ((stage.actualCost - stage.plannedCost) / stage.plannedCost) * 100
      if (stageDeviation > 20) {
        suggestions.push(`${stage.name}阶段成本超支${stageDeviation.toFixed(1)}%，建议检查资源配置和进度安排。`)
      }
    }
  }

  // 分析团队成本偏差
  for (const team of teamCosts) {
    if (team.deviationRate > 15) {
      suggestions.push(`${team.team}团队成本偏差${team.deviationRate.toFixed(1)}%，建议优化团队人员配置。`)
    }
  }

  return suggestions.join('\n')
}

/**
 * 计算团队成本偏差
 */
const calculateTeamCosts = (
  expectedStages: StageInfo[],
  actualStages: StageInfo[]
): TeamCostInfo[] => {
  // 假设团队分配
  const teams = [
    { name: '需求团队', stageWeights: { '需求分析': 1.0, '系统设计': 0.3 } },
    { name: '设计团队', stageWeights: { '系统设计': 0.7, '编码开发': 0.2 } },
    { name: '开发团队', stageWeights: { '编码开发': 0.8, '测试验证': 0.1 } },
    { name: '测试团队', stageWeights: { '测试验证': 0.9, '部署上线': 0.3 } },
    { name: '运维团队', stageWeights: { '部署上线': 0.7 } }
  ]

  return teams.map(team => {
    let plannedCost = 0
    let actualCost = 0

    for (const stage of expectedStages) {
      const weight = team.stageWeights[stage.name as keyof typeof team.stageWeights] || 0
      plannedCost += (stage.plannedCost || 0) * weight
    }

    for (const stage of actualStages) {
      const weight = team.stageWeights[stage.name as keyof typeof team.stageWeights] || 0
      actualCost += (stage.actualCost || 0) * weight
    }

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
  { name: '需求分析', plannedProgress: 100, actualProgress: 0, plannedCost: 15 },
  { name: '系统设计', plannedProgress: 100, actualProgress: 0, plannedCost: 20 },
  { name: '编码开发', plannedProgress: 100, actualProgress: 0, plannedCost: 35 },
  { name: '测试验证', plannedProgress: 100, actualProgress: 0, plannedCost: 15 },
  { name: '部署上线', plannedProgress: 100, actualProgress: 0, plannedCost: 10 },
  { name: '运维支持', plannedProgress: 100, actualProgress: 0, plannedCost: 5 }
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

    const deviation = await prisma.costDeviation.findFirst({
      where: { projectId: Number(projectId) }
    })

    if (!deviation) {
      return sendError(res, 404, '未找到偏差记录')
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

    const deviation = await prisma.costDeviation.findFirst({
      where: { projectId: Number(projectId) }
    })

    if (!deviation) {
      return sendError(res, 404, '未找到偏差记录')
    }

    const expectedStages: StageInfo[] = JSON.parse(deviation.expectedStages || '[]')
    let actualStages: StageInfo[] = data.actualStages || JSON.parse(deviation.actualStages || '[]')

    // 如果没有实际阶段数据，使用偏差记录中的数据
    if (actualStages.length === 0) {
      actualStages = JSON.parse(deviation.actualStages || '[]')
    }

    // 计算成本偏差
    // 成本偏差 = (实际成本消耗 / 合同金额) - 任务进度
    const costConsumptionRate = deviation.totalContractAmount > 0
      ? (deviation.currentCostConsumption / deviation.totalContractAmount) * 100
      : 0

    const costDeviation = costConsumptionRate - deviation.taskProgress

    // 计算团队成本偏差
    const teamCosts = calculateTeamCosts(expectedStages, actualStages)

    // 生成AI建议
    const aiSuggestion = generateAiSuggestion(Math.abs(costDeviation), actualStages, teamCosts)

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
      currentCostConsumption: deviation.currentCostConsumption,
      taskProgress: deviation.taskProgress,
      costDeviation,
      deviationStatus,
      baselineType: deviation.baselineType,
      expectedStages,
      actualStages,
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

    const deviation = await prisma.costDeviation.findFirst({
      where: { projectId: Number(projectId) }
    })

    if (!deviation) {
      return sendError(res, 404, '未找到偏差记录')
    }

    // 如果没有AI建议，生成一份
    let aiSuggestion = deviation.aiSuggestion

    if (!aiSuggestion) {
      const expectedStages: StageInfo[] = JSON.parse(deviation.expectedStages || '[]')
      const actualStages: StageInfo[] = JSON.parse(deviation.actualStages || '[]')
      const teamCosts: TeamCostInfo[] = JSON.parse(deviation.teamCosts || '[]')

      aiSuggestion = generateAiSuggestion(Math.abs(deviation.costDeviation), actualStages, teamCosts)

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

    const deviation = await prisma.costDeviation.findFirst({
      where: { projectId: Number(projectId) }
    })

    if (!deviation) {
      return sendError(res, 404, '未找到偏差分析结果')
    }

    const expectedStages: StageInfo[] = JSON.parse(deviation.expectedStages || '[]')
    const actualStages: StageInfo[] = JSON.parse(deviation.actualStages || '[]')
    const teamCosts: TeamCostInfo[] = JSON.parse(deviation.teamCosts || '[]')
    const deviationStatus = getDeviationStatus(Math.abs(deviation.costDeviation))

    const response: DeviationResult = {
      totalContractAmount: deviation.totalContractAmount,
      currentCostConsumption: deviation.currentCostConsumption,
      taskProgress: deviation.taskProgress,
      costDeviation: deviation.costDeviation,
      deviationStatus,
      baselineType: deviation.baselineType,
      expectedStages,
      actualStages,
      teamCosts,
      aiSuggestion: deviation.aiSuggestion
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
      const actual = actualStages.find(a => a.name === expected.name) || expected
      const progressDiff = actual.actualProgress - expected.plannedProgress
      const costDiff = (actual.actualCost || 0) - (expected.plannedCost || 0)
      stageData.push([
        expected.name,
        String(expected.plannedProgress),
        String(actual.actualProgress),
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

export default router