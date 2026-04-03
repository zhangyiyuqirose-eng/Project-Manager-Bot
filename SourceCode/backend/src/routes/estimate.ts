import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import mammoth from 'mammoth'
import prisma from '../config/database'
import { authMiddleware } from '../middlewares/auth'
import {
  ApiResponse,
  UploadDocumentResponse,
  ParseDocumentResponse,
  ParseResult,
  ModuleInfo,
  EstimateConfigRequest,
  EstimateConfigResponse,
  CalculateEstimateResponse,
  StageDetail,
  TeamDetail,
  CalcTraceItem,
  ComplexityConfig,
  SystemCoefficient,
  ProcessCoefficient,
  TechStackCoefficient,
  UnitPriceConfig,
  AuthenticatedRequest
} from '../types'

const router = Router()

// ==================== 文件上传配置 ====================

const uploadDir = path.join(process.cwd(), 'uploads', 'documents')

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`
    cb(null, uniqueName)
  }
})

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.doc', '.docx']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowedExtensions.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('只支持 DOC/DOCX 格式的文档'))
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
})

// ==================== 默认配置 ====================

const DEFAULT_COMPLEXITY_CONFIG: ComplexityConfig = {
  simple: 2,
  medium: 5,
  complex: 10
}

const DEFAULT_SYSTEM_COEFFICIENT: SystemCoefficient = {
  distributed: 1.2,
  microservice: 1.3,
  monomer: 1.0
}

const DEFAULT_PROCESS_COEFFICIENT: ProcessCoefficient = {
  agile: 1.1,
  waterfall: 1.0,
  hybrid: 1.05
}

const DEFAULT_TECH_STACK_COEFFICIENT: TechStackCoefficient = {
  java: 1.0,
  python: 0.9,
  nodejs: 0.95,
  dotnet: 1.0,
  go: 0.85
}

const DEFAULT_UNIT_PRICE_CONFIG: UnitPriceConfig = {
  P5: 0.8,
  P6: 1.0,
  P7: 1.5,
  P8: 2.0
}

const DEFAULT_MANAGEMENT_COEFFICIENT = 0.2

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
 * 解析 DOC/DOCX 文档内容
 */
const parseDocumentContent = async (filePath: string): Promise<string> => {
  const result = await mammoth.extractRawText({ path: filePath })
  return result.value
}

/**
 * 从文档文本中提取模块信息
 */
const extractModulesFromText = (text: string): ModuleInfo[] => {
  const modules: ModuleInfo[] = []

  // 简化的模块提取逻辑 - 实际项目中应该使用大模型进行智能解析
  const lines = text.split('\n')
  let currentModule: ModuleInfo | null = null
  const features: string[] = []

  for (const line of lines) {
    const trimmedLine = line.trim()

    // 检测模块标题 (通常是带有"模块"、"功能"、"子系统"等关键词的行)
    if (trimmedLine.includes('模块') || trimmedLine.includes('子系统')) {
      if (currentModule) {
        currentModule.features = [...features]
        modules.push(currentModule)
        features.length = 0
      }
      currentModule = {
        name: trimmedLine,
        description: '',
        complexity: 'medium',
        features: []
      }
    } else if (currentModule && trimmedLine.length > 0) {
      // 收集功能点
      if (trimmedLine.startsWith('-') || trimmedLine.startsWith('*') || trimmedLine.match(/^\d+\./)) {
        features.push(trimmedLine.replace(/^-|\*|\d+\.\s*/, '').trim())
      } else if (!currentModule.description && trimmedLine.length > 20) {
        currentModule.description = trimmedLine
      }
    }
  }

  // 处理最后一个模块
  if (currentModule) {
    currentModule.features = [...features]
    modules.push(currentModule)
  }

  // 如果没有检测到模块，创建默认模块
  if (modules.length === 0 && text.length > 100) {
    modules.push({
      name: '核心功能模块',
      description: '从需求文档自动识别的核心功能',
      complexity: 'medium',
      features: ['基础功能', '核心业务', '数据管理']
    })
  }

  return modules
}

// ==================== 路由定义 ====================

/**
 * POST /upload - 上传需求文档
 */
router.post('/upload', authMiddleware, upload.single('document'), async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const userId = authReq.userId
    const file = req.file

    if (!file) {
      return sendError(res, 400, '请上传文档文件')
    }

    // 创建项目
    const project = await prisma.project.create({
      data: {
        userId,
        projectName: path.basename(file.originalname, path.extname(file.originalname)),
        projectType: 'software',
        status: 'ongoing'
      }
    })

    // 创建文档记录
    const document = await prisma.projectDocument.create({
      data: {
        projectId: project.id,
        docName: file.originalname,
        docPath: file.filename,
        docType: 'requirement',
        parseStatus: 'pending'
      }
    })

    const response: UploadDocumentResponse = {
      documentId: document.id,
      docName: document.docName,
      docPath: `/uploads/documents/${file.filename}`
    }

    sendResponse(res, { ...response, projectId: project.id }, '文档上传成功')
  } catch (error) {
    console.error('Upload error:', error)
    sendError(res, 500, '文档上传失败')
  }
})

/**
 * POST /:projectId/parse - 解析文档
 */
router.post('/:projectId/parse', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const { projectId } = req.params
    const userId = authReq.userId

    if (!await verifyProjectOwnership(Number(projectId), userId)) {
      return sendError(res, 403, '无权访问该项目')
    }

    // 获取项目文档
    const document = await prisma.projectDocument.findFirst({
      where: { projectId: Number(projectId) }
    })

    if (!document) {
      return sendError(res, 404, '未找到项目文档')
    }

    // 更新解析状态
    await prisma.projectDocument.update({
      where: { id: document.id },
      data: { parseStatus: 'parsing' }
    })

    // 解析文档内容
    const filePath = path.join(uploadDir, document.docPath || '')
    const text = await parseDocumentContent(filePath)
    const modules = extractModulesFromText(text)

    // 更新解析结果
    const parseResult: ParseResult = {
      modules,
      totalModules: modules.length,
      rawText: text.substring(0, 5000) // 保存部分原文用于追溯
    }

    await prisma.projectDocument.update({
      where: { id: document.id },
      data: {
        parseStatus: 'success',
        parseResult: JSON.stringify(parseResult)
      }
    })

    const response: ParseDocumentResponse = {
      documentId: document.id,
      parseStatus: 'success',
      parseResult
    }

    sendResponse(res, response, '文档解析成功')
  } catch (error) {
    console.error('Parse error:', error)

    // 更新解析状态为失败
    const document = await prisma.projectDocument.findFirst({
      where: { projectId: Number(req.params.projectId) }
    })
    if (document) {
      await prisma.projectDocument.update({
        where: { id: document.id },
        data: { parseStatus: 'failed' }
      })
    }

    sendError(res, 500, '文档解析失败')
  }
})

/**
 * GET /config/default - 获取默认参数配置
 */
router.get('/config/default', authMiddleware, async (req: Request, res: Response) => {
  try {
    const defaultConfig: EstimateConfigResponse = {
      id: 0,
      projectId: 0,
      complexityConfig: DEFAULT_COMPLEXITY_CONFIG,
      systemCoefficient: DEFAULT_SYSTEM_COEFFICIENT,
      processCoefficient: DEFAULT_PROCESS_COEFFICIENT,
      techStackCoefficient: DEFAULT_TECH_STACK_COEFFICIENT,
      unitPriceConfig: DEFAULT_UNIT_PRICE_CONFIG,
      managementCoefficient: DEFAULT_MANAGEMENT_COEFFICIENT
    }

    sendResponse(res, defaultConfig, '获取默认配置成功')
  } catch (error) {
    console.error('Get default config error:', error)
    sendError(res, 500, '获取默认配置失败')
  }
})

/**
 * POST /:projectId/config - 保存参数配置
 */
router.post('/:projectId/config', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const { projectId } = req.params
    const userId = authReq.userId
    const configData: EstimateConfigRequest = req.body

    if (!await verifyProjectOwnership(Number(projectId), userId)) {
      return sendError(res, 403, '无权访问该项目')
    }

    // 创建或更新配置
    const existingConfig = await prisma.estimateConfig.findFirst({
      where: { projectId: Number(projectId) }
    })

    const configToSave = {
      complexityConfig: JSON.stringify(configData.complexityConfig || DEFAULT_COMPLEXITY_CONFIG),
      systemCoefficient: JSON.stringify(configData.systemCoefficient || DEFAULT_SYSTEM_COEFFICIENT),
      processCoefficient: JSON.stringify(configData.processCoefficient || DEFAULT_PROCESS_COEFFICIENT),
      techStackCoefficient: JSON.stringify(configData.techStackCoefficient || DEFAULT_TECH_STACK_COEFFICIENT),
      unitPriceConfig: JSON.stringify(configData.unitPriceConfig || DEFAULT_UNIT_PRICE_CONFIG),
      managementCoefficient: configData.managementCoefficient || DEFAULT_MANAGEMENT_COEFFICIENT
    }

    if (existingConfig) {
      const updated = await prisma.estimateConfig.update({
        where: { id: existingConfig.id },
        data: configToSave
      })

      const response: EstimateConfigResponse = {
        id: updated.id,
        projectId: updated.projectId,
        complexityConfig: JSON.parse(updated.complexityConfig || '{}'),
        systemCoefficient: JSON.parse(updated.systemCoefficient || '{}'),
        processCoefficient: JSON.parse(updated.processCoefficient || '{}'),
        techStackCoefficient: JSON.parse(updated.techStackCoefficient || '{}'),
        unitPriceConfig: JSON.parse(updated.unitPriceConfig || '{}'),
        managementCoefficient: updated.managementCoefficient
      }

      sendResponse(res, response, '配置更新成功')
    } else {
      const created = await prisma.estimateConfig.create({
        data: {
          projectId: Number(projectId),
          ...configToSave
        }
      })

      const response: EstimateConfigResponse = {
        id: created.id,
        projectId: created.projectId,
        complexityConfig: JSON.parse(created.complexityConfig || '{}'),
        systemCoefficient: JSON.parse(created.systemCoefficient || '{}'),
        processCoefficient: JSON.parse(created.processCoefficient || '{}'),
        techStackCoefficient: JSON.parse(created.techStackCoefficient || '{}'),
        unitPriceConfig: JSON.parse(created.unitPriceConfig || '{}'),
        managementCoefficient: created.managementCoefficient
      }

      sendResponse(res, response, '配置保存成功')
    }
  } catch (error) {
    console.error('Save config error:', error)
    sendError(res, 500, '配置保存失败')
  }
})

/**
 * POST /:projectId/calculate - 计算工作量
 */
router.post('/:projectId/calculate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const { projectId } = req.params
    const userId = authReq.userId

    if (!await verifyProjectOwnership(Number(projectId), userId)) {
      return sendError(res, 403, '无权访问该项目')
    }

    // 获取解析结果
    const document = await prisma.projectDocument.findFirst({
      where: { projectId: Number(projectId), parseStatus: 'success' }
    })

    if (!document || !document.parseResult) {
      return sendError(res, 400, '请先解析需求文档')
    }

    const parseResult: ParseResult = JSON.parse(document.parseResult)

    // 获取配置
    const config = await prisma.estimateConfig.findFirst({
      where: { projectId: Number(projectId) }
    })

    const complexityConfig: ComplexityConfig = config
      ? JSON.parse(config.complexityConfig || '{}')
      : DEFAULT_COMPLEXITY_CONFIG

    const systemCoefficient: SystemCoefficient = config
      ? JSON.parse(config.systemCoefficient || '{}')
      : DEFAULT_SYSTEM_COEFFICIENT

    const processCoefficient: ProcessCoefficient = config
      ? JSON.parse(config.processCoefficient || '{}')
      : DEFAULT_PROCESS_COEFFICIENT

    const techStackCoefficient: TechStackCoefficient = config
      ? JSON.parse(config.techStackCoefficient || '{}')
      : DEFAULT_TECH_STACK_COEFFICIENT

    const unitPriceConfig: UnitPriceConfig = config
      ? JSON.parse(config.unitPriceConfig || '{}')
      : DEFAULT_UNIT_PRICE_CONFIG

    const managementCoefficient = config?.managementCoefficient || DEFAULT_MANAGEMENT_COEFFICIENT

    // 计算逻辑
    const calcTrace: CalcTraceItem[] = []
    let totalBaseManDays = 0

    // 步骤1: 基础工作量计算
    const moduleManDays: { name: string; complexity: string; manDays: number }[] = []
    for (const module of parseResult.modules) {
      const complexity = module.complexity || 'medium'
      const baseManDays = complexityConfig[complexity as keyof ComplexityConfig] || 5
      totalBaseManDays += baseManDays
      moduleManDays.push({
        name: module.name,
        complexity,
        manDays: baseManDays
      })
    }

    calcTrace.push({
      step: '基础工作量计算',
      input: { modules: parseResult.modules.map(m => m.name), complexityConfig },
      output: { moduleManDays, totalBaseManDays },
      formula: 'Σ(模块复杂度对应人天)'
    })

    // 步骤2: 应用系数
    const systemType = 'distributed' // 默认分布式系统
    const processType = 'agile' // 默认敏捷开发
    const techStack = 'java' // 默认Java技术栈

    const systemCoef = systemCoefficient[systemType as keyof SystemCoefficient] || 1.0
    const processCoef = processCoefficient[processType as keyof ProcessCoefficient] || 1.0
    const techCoef = techStackCoefficient[techStack as keyof TechStackCoefficient] || 1.0

    const adjustedManDays = totalBaseManDays * systemCoef * processCoef * techCoef

    calcTrace.push({
      step: '系数调整',
      input: {
        totalBaseManDays,
        systemCoefficient: systemCoef,
        processCoefficient: processCoef,
        techStackCoefficient: techCoef
      },
      output: { adjustedManDays },
      formula: '基础人天 × 系统系数 × 流程系数 × 技术栈系数'
    })

    // 步骤3: 管理成本
    const totalManDay = adjustedManDays * (1 + managementCoefficient)

    calcTrace.push({
      step: '管理成本叠加',
      input: { adjustedManDays, managementCoefficient },
      output: { totalManDay },
      formula: '调整后人天 × (1 + 管理系数)'
    })

    // 步骤4: 阶段分解
    const stageRatios = {
      '需求分析': 0.15,
      '系统设计': 0.20,
      '编码开发': 0.35,
      '测试验证': 0.15,
      '部署上线': 0.10,
      '运维支持': 0.05
    }

    const stageDetail: StageDetail[] = Object.entries(stageRatios).map(([stage, ratio]) => ({
      stage,
      manDays: Math.round(totalManDay * ratio),
      percentage: ratio * 100,
      description: `${stage}阶段工作量`
    }))

    calcTrace.push({
      step: '阶段分解',
      input: { totalManDay, stageRatios },
      output: { stageDetail }
    })

    // 步骤5: 团队配置与成本计算
    const manMonth = totalManDay / 22 // 每月22工作日
    const avgUnitPrice = (unitPriceConfig.P5 + unitPriceConfig.P6 + unitPriceConfig.P7 + unitPriceConfig.P8) / 4

    // 假设团队配置: 1 P8 + 2 P7 + 3 P6 + 2 P5
    const teamConfig = [
      { level: 'P8', count: 1 },
      { level: 'P7', count: 2 },
      { level: 'P6', count: 3 },
      { level: 'P5', count: 2 }
    ]

    const teamDetail: TeamDetail[] = teamConfig.map(team => {
      const dailyCost = unitPriceConfig[team.level as keyof UnitPriceConfig]
      const memberManDays = totalManDay * (team.count / teamConfig.reduce((sum, t) => sum + t.count, 0))
      const totalCost = memberManDays * dailyCost
      return {
        level: team.level,
        count: team.count,
        dailyCost,
        totalCost,
        manDays: Math.round(memberManDays)
      }
    })

    const totalCost = teamDetail.reduce((sum, team) => sum + team.totalCost, 0)

    calcTrace.push({
      step: '团队成本计算',
      input: { teamConfig, unitPriceConfig, totalManDay },
      output: { teamDetail, totalCost }
    })

    // 保存结果
    const existingResult = await prisma.estimateResult.findFirst({
      where: { projectId: Number(projectId) }
    })

    const resultData = {
      totalManDay: Math.round(totalManDay),
      totalCost,
      moduleCount: parseResult.totalModules,
      manMonth,
      stageDetail: JSON.stringify(stageDetail),
      teamDetail: JSON.stringify(teamDetail),
      calcTrace: JSON.stringify(calcTrace)
    }

    if (existingResult) {
      await prisma.estimateResult.update({
        where: { id: existingResult.id },
        data: resultData
      })
    } else {
      await prisma.estimateResult.create({
        data: {
          projectId: Number(projectId),
          ...resultData
        }
      })
    }

    const response: CalculateEstimateResponse = {
      totalManDay: Math.round(totalManDay),
      totalCost,
      moduleCount: parseResult.totalModules,
      manMonth,
      stageDetail,
      teamDetail,
      calcTrace
    }

    sendResponse(res, response, '工作量计算成功')
  } catch (error) {
    console.error('Calculate error:', error)
    sendError(res, 500, '工作量计算失败')
  }
})

/**
 * GET /:projectId/result - 获取计算结果
 */
router.get('/:projectId/result', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const { projectId } = req.params
    const userId = authReq.userId

    if (!await verifyProjectOwnership(Number(projectId), userId)) {
      return sendError(res, 403, '无权访问该项目')
    }

    const result = await prisma.estimateResult.findFirst({
      where: { projectId: Number(projectId) },
      orderBy: { createdAt: 'desc' }
    })

    if (!result) {
      return sendError(res, 404, '未找到计算结果')
    }

    const response: CalculateEstimateResponse = {
      totalManDay: result.totalManDay,
      totalCost: result.totalCost,
      moduleCount: result.moduleCount,
      manMonth: result.manMonth,
      stageDetail: JSON.parse(result.stageDetail || '[]'),
      teamDetail: JSON.parse(result.teamDetail || '[]'),
      calcTrace: JSON.parse(result.calcTrace || '[]')
    }

    sendResponse(res, response, '获取结果成功')
  } catch (error) {
    console.error('Get result error:', error)
    sendError(res, 500, '获取计算结果失败')
  }
})

/**
 * GET /:projectId/export - 导出Excel报告
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

    const result = await prisma.estimateResult.findFirst({
      where: { projectId: Number(projectId) },
      orderBy: { createdAt: 'desc' }
    })

    if (!result || !project) {
      return sendError(res, 404, '未找到计算结果')
    }

    const stageDetail: StageDetail[] = JSON.parse(result.stageDetail || '[]')
    const teamDetail: TeamDetail[] = JSON.parse(result.teamDetail || '[]')

    // 导出目录
    const exportDir = path.join(process.cwd(), 'uploads', 'exports')
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true })
    }

    const fileName = `estimate_${project.projectName}_${Date.now()}.xlsx`
    const filePath = path.join(exportDir, fileName)

    // 创建 Excel 文件（这里使用简化的方式，实际应使用 xlsx 库）
    const xlsx = await import('xlsx')
    const wb = xlsx.utils.book_new()

    // 概览页
    const summaryData = [
      ['项目名称', project.projectName],
      ['总工作量（人天）', result.totalManDay],
      ['总工作量（人月）', result.manMonth],
      ['模块数量', result.moduleCount],
      ['总成本（万元）', result.totalCost],
      ['计算时间', result.createdAt.toLocaleString()]
    ]
    const summaryWs = xlsx.utils.aoa_to_sheet(summaryData)
    xlsx.utils.book_append_sheet(wb, summaryWs, '概览')

    // 阶段明细页
    const stageData = [['阶段', '工作量（人天）', '占比（%）', '描述']]
    stageDetail.forEach(stage => {
      stageData.push([stage.stage, String(stage.manDays), String(stage.percentage), stage.description])
    })
    const stageWs = xlsx.utils.aoa_to_sheet(stageData)
    xlsx.utils.book_append_sheet(wb, stageWs, '阶段明细')

    // 团队明细页
    const teamData = [['职级', '人数', '日成本（万元）', '总成本（万元）', '工作量（人天）']]
    teamDetail.forEach(team => {
      teamData.push([team.level, String(team.count), String(team.dailyCost), String(team.totalCost), String(team.manDays)])
    })
    const teamWs = xlsx.utils.aoa_to_sheet(teamData)
    xlsx.utils.book_append_sheet(wb, teamWs, '团队明细')

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