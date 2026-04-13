import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import mammoth from 'mammoth'
import ExcelJS from 'exceljs'
import prisma from '../config/database'
import { authMiddleware } from '../middlewares/auth'
import aiService from '../services/aiService'

/**
 * 修复中文文件名乱码问题
 * multer 接收的 file.originalname 可能是 latin1 编码，需要转换为 utf8
 */
function decodeFilename(filename: string): string {
  try {
    // 尝试从 latin1 转换为 utf8
    const decoded = Buffer.from(filename, 'latin1').toString('utf8')
    // 如果解码后包含乱码特征（如  或 ），则返回原文件名
    if (decoded.includes('') || decoded.includes('')) {
      return filename
    }
    return decoded
  } catch {
    return filename
  }
}
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
    // 解码文件名，修复中文乱码
    const decodedName = decodeFilename(file.originalname)
    const uniqueName = `${uuidv4()}${path.extname(decodedName)}`
    // 将解码后的文件名存储到 file 对象中
    file.originalname = decodedName
    cb(null, uniqueName)
  }
})

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // 先解码文件名
    const decodedName = decodeFilename(file.originalname)
    file.originalname = decodedName
    const allowedExtensions = ['.doc', '.docx']
    const ext = path.extname(decodedName).toLowerCase()
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

// ==================== 默认配置（参考 Python 实现）====================

const DEFAULT_COMPLEXITY_CONFIG: Record<string, number> = {
  very_basic: 0.5,
  basic: 1.0,
  medium: 1.5,
  complex: 2.0,
  very_complex: 2.5
}

const DEFAULT_FLOW_COEFFICIENTS: Record<string, number> = {
  requirements: 0.7,
  ui_design: 0.3,
  tech_design: 0.5,
  development: 1.2,
  tech_testing: 0.7,
  perf_testing: 0.3
}

const DEFAULT_TECH_STACK_COEFFICIENT = 1.3
const DEFAULT_MANAGEMENT_COEFFICIENT = 0.15
const DEFAULT_GO_LIVE_PERCENTAGE = 0.02

const DEFAULT_DAILY_RATES: Record<string, number> = {
  product_manager: 2000,
  ui_designer: 1800,
  frontend_dev: 1800,
  backend_dev: 2000,
  func_tester: 1500,
  perf_tester: 2000,
  project_manager: 2000
}

// 阶段定义
const PHASES = [
  { key: 'requirements', name: '需求', usesTechStack: false },
  { key: 'ui_design', name: 'UI设计', usesTechStack: false },
  { key: 'tech_design', name: '技术设计', usesTechStack: true },
  { key: 'development', name: '开发', usesTechStack: true },
  { key: 'tech_testing', name: '技术测试', usesTechStack: true },
  { key: 'perf_testing', name: '性能测试', usesTechStack: false }
]

// 合规区间
const COMPLIANCE_RANGES: Record<string, [number, number]> = {
  '需求': [12, 18],
  '设计': [12, 20],
  '开发': [30, 40],
  '技术测试': [15, 25],
  '性能测试': [0, 12],
  '投产上线': [2, 2]
}

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
 * 获取关联度系数（参考 Python 实现）
 */
const getAssociationCoefficient = (nSystems: number): number => {
  if (nSystems <= 1) return 1.0
  if (nSystems < 3) return 1.5
  if (nSystems <= 5) return 2.0
  return 3.0
}

/**
 * 阶段合计四舍五入到0.5人天（参考 Python round_phase_total 实现）
 */
const roundPhaseTotal = (v: number): number => {
  if (v <= 0) return 0.0
  return Math.round(Math.round(v * 2) / 2 * 10) / 10
}

/**
 * 单功能点工作量保留两位小数（参考 Python round_workload 实现）
 */
const roundWorkload = (v: number): number => {
  if (v <= 0) return 0.0
  return Math.round(v * 100) / 100
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

    console.log(`[Upload] 文件上传成功: ${file.originalname}`)

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
 * POST /:projectId/parse - 解析文档（使用 AI）
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

    console.log(`[Parse] 开始 AI 分析，文档长度: ${text.length}`)

    // 使用 AI 解析文档
    const aiResult = await aiService.parseDocument(text.substring(0, 12000))

    console.log(`[Parse] AI 分析完成，模块数: ${aiResult.modules?.length || 0}`)

    // 转换为内部格式
    const modules: ModuleInfo[] = (aiResult.modules || []).map((m: any) => ({
      name: m.name || '未命名模块',
      description: m.description || '',
      complexity: mapComplexity(m.complexity),
      features: (m.functions || m.features || []).map((f: any) =>
        typeof f === 'string' ? f : f.name || '未命名功能'
      ),
      associationSystems: m.association_systems || 1
    }))

    const parseResult: ParseResult = {
      modules,
      totalModules: modules.length,
      rawText: text.substring(0, 5000),
      projectName: aiResult.project_name || document.docName.replace(/\.(doc|docx)$/i, ''),
      systemName: aiResult.system_name || ''
    }

    // 如果 AI 成功提取了项目名称，更新项目表中的项目名称
    if (aiResult.project_name && aiResult.project_name.trim()) {
      await prisma.project.update({
        where: { id: Number(projectId) },
        data: { projectName: aiResult.project_name.trim() }
      })
      console.log(`[Parse] 更新项目名称: ${aiResult.project_name}`)
    }

    // 更新解析结果
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
 * 映射复杂度
 */
function mapComplexity(complexity: string): 'simple' | 'medium' | 'complex' {
  const mapping: Record<string, 'simple' | 'medium' | 'complex'> = {
    very_basic: 'simple',
    basic: 'simple',
    medium: 'medium',
    complex: 'complex',
    very_complex: 'complex'
  }
  return mapping[complexity?.toLowerCase()] || 'medium'
}

/**
 * GET /config/default - 获取默认参数配置
 */
router.get('/config/default', authMiddleware, async (req: Request, res: Response) => {
  try {
    // 将对象格式转换为前端期望的数组格式
    const complexityConfigArray = Object.entries(DEFAULT_COMPLEXITY_CONFIG).map(([key, value]) => ({
      level: mapComplexityLabel(key),
      workdays: value
    }))

    const systemCoefficientArray = [
      { systemCount: 1, coefficient: 1.0 },
      { systemCount: 2, coefficient: 1.5 },
      { systemCount: 5, coefficient: 2.0 },
      { systemCount: 6, coefficient: 3.0 }
    ]

    const processCoefficientArray = [
      { stage: '需求分析', coefficient: 0.15 },
      { stage: '系统设计', coefficient: 0.20 },
      { stage: '开发实现', coefficient: 0.40 },
      { stage: '测试验证', coefficient: 0.15 },
      { stage: '部署上线', coefficient: 0.10 }
    ]

    const techStackCoefficientArray = [
      { techType: '常规技术', coefficient: 1.0 },
      { techType: '新技术应用', coefficient: 1.3 },
      { techType: '复杂架构', coefficient: 1.5 }
    ]

    const unitPriceConfigArray = Object.entries(DEFAULT_DAILY_RATES).map(([key, value]) => ({
      role: mapRoleLabel(key),
      price: value
    }))

    const defaultConfig = {
      id: 0,
      projectId: 0,
      complexityConfig: complexityConfigArray,
      systemCoefficientConfig: systemCoefficientArray,
      processCoefficientConfig: processCoefficientArray,
      techStackCoefficientConfig: techStackCoefficientArray,
      unitPriceConfig: unitPriceConfigArray,
      managementCoefficient: DEFAULT_MANAGEMENT_COEFFICIENT
    }

    sendResponse(res, defaultConfig, '获取默认配置成功')
  } catch (error) {
    console.error('Get default config error:', error)
    sendError(res, 500, '获取默认配置失败')
  }
})

// 复杂度key转中文标签
function mapComplexityLabel(key: string): string {
  const mapping: Record<string, string> = {
    very_basic: '较为基础',
    basic: '基础',
    medium: '中等',
    complex: '复杂',
    very_complex: '极复杂'
  }
  return mapping[key] || key
}

// 角色key转中文标签
function mapRoleLabel(key: string): string {
  const mapping: Record<string, string> = {
    product_manager: '产品经理',
    ui_designer: 'UI设计师',
    frontend_dev: '前端开发',
    backend_dev: '后端开发',
    func_tester: '功能测试',
    perf_tester: '性能测试',
    project_manager: '项目经理'
  }
  return mapping[key] || key
}

/**
 * GET /:projectId/config - 获取项目已保存的配置
 */
router.get('/:projectId/config', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const { projectId } = req.params
    const userId = authReq.userId

    if (!await verifyProjectOwnership(Number(projectId), userId)) {
      return sendError(res, 403, '无权访问该项目')
    }

    const config = await prisma.estimateConfig.findFirst({
      where: { projectId: Number(projectId) }
    })

    if (!config) {
      // 没有保存的配置时返回null，而不是404错误
      return sendResponse(res, null, '该项目尚未保存配置')
    }

    const response: EstimateConfigResponse = {
      id: config.id,
      projectId: config.projectId,
      complexityConfig: JSON.parse(config.complexityConfig || '{}'),
      systemCoefficient: JSON.parse(config.systemCoefficient || '{}'),
      processCoefficient: JSON.parse(config.processCoefficient || '{}'),
      techStackCoefficient: JSON.parse(config.techStackCoefficient || '{}'),
      unitPriceConfig: JSON.parse(config.unitPriceConfig || '{}'),
      managementCoefficient: config.managementCoefficient
    }

    sendResponse(res, response, '获取配置成功')
  } catch (error) {
    console.error('Get config error:', error)
    sendError(res, 500, '获取配置失败')
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
      systemCoefficient: JSON.stringify(configData.systemCoefficient || {}),
      processCoefficient: JSON.stringify(configData.processCoefficient || {}),
      techStackCoefficient: JSON.stringify(configData.techStackCoefficient || {}),
      unitPriceConfig: JSON.stringify(configData.unitPriceConfig || DEFAULT_DAILY_RATES),
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
 * POST /:projectId/calculate - 计算工作量（严格参考 Python estimate_workload_v2 实现）
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

    const complexityConfig: Record<string, number> = config
      ? JSON.parse(config.complexityConfig || '{}')
      : DEFAULT_COMPLEXITY_CONFIG

    const flowCoefficients: Record<string, number> = DEFAULT_FLOW_COEFFICIENTS
    const techStackCoefficient = DEFAULT_TECH_STACK_COEFFICIENT
    const managementCoefficient = config?.managementCoefficient || DEFAULT_MANAGEMENT_COEFFICIENT
    const goLivePercentage = DEFAULT_GO_LIVE_PERCENTAGE
    const dailyRates = config
      ? JSON.parse(config.unitPriceConfig || '{}')
      : DEFAULT_DAILY_RATES

    // ========== 核心计算逻辑（严格参考 Python estimate_workload_v2）==========

    const items: any[] = []
    const traces: any[] = []  // 详细功能点计算轨迹
    const calcTrace: CalcTraceItem[] = []

    // 阶段原始值累加器（未乘管理系数、未取整）
    const phaseRawSums: Record<string, number> = {}

    // 初始化阶段累加器
    for (const phase of PHASES) {
      phaseRawSums[phase.name] = 0.0
    }

    // 逐模块逐功能点计算
    for (const module of parseResult.modules) {
      // 获取功能点列表（关键：支持 functions 或 features 字段）
      // Python版本使用 functions 数组，每个功能点有独立的 complexity 和 association_systems
      const functions = (module as any).functions ||
                        (module.features || []).map((f: string) => ({
                          name: typeof f === 'string' ? f : (f as any).name || '未命名功能',
                          complexity: (module as any).complexity || 'medium',
                          association_systems: (module as any).associationSystems || 1
                        }))

      for (const func of functions) {
        const funcName = typeof func === 'string' ? func : (func.name || '未命名功能')

        // 1. 获取复杂度（参考 Python 第478-482行）
        let cx = String((func as any).complexity || 'medium').toLowerCase()
        if (cx === 'simple') cx = 'basic'  // 兼容处理
        if (!['very_basic', 'basic', 'medium', 'complex', 'very_complex'].includes(cx)) {
          cx = 'medium'
        }

        // 2. 获取复杂度基准人天
        const baseDays = complexityConfig[cx] || complexityConfig['medium'] || 1.5

        // 3. 获取关联度系数（关键：从功能点获取 association_systems）
        // 参考 Python 第496-502行
        let assocCoeff = 1.0
        let assocSystems = 1

        if ((func as any).association_coeff !== undefined && (func as any).association_coeff !== null) {
          // 如果直接提供了关联度系数
          assocCoeff = parseFloat((func as any).association_coeff)
        } else if ((func as any).association_systems !== undefined && (func as any).association_systems !== null) {
          // 从关联系统数量计算
          assocSystems = parseInt((func as any).association_systems) || 1
          assocCoeff = getAssociationCoefficient(assocSystems)
        } else if ((module as any).associationSystems !== undefined) {
          // 兼容：从模块获取
          assocSystems = (module as any).associationSystems
          assocCoeff = getAssociationCoefficient(assocSystems)
        }

        // 4. 记录轨迹（参考 Python 第503-514行）
        const trace: any = {
          module: module.name,
          function: funcName,
          complexity: cx,
          base: baseDays,
          assoc: assocCoeff,
          assoc_systems: assocSystems,
          tech_stack: techStackCoefficient,
          mgmt: managementCoefficient,
          phases: {}
        }

        // 5. 逐阶段计算（参考 Python 第516-557行）
        for (const phase of PHASES) {
          const flowCoeff = flowCoefficients[phase.key] || 0
          if (flowCoeff === 0) continue

          let rawNoMgmt: number
          if (phase.usesTechStack) {
            // 需求方案公式：基准 × 关联度 × 流程系数 × 技术栈系数
            rawNoMgmt = baseDays * assocCoeff * flowCoeff * techStackCoefficient
          } else {
            // 不含技术栈系数
            rawNoMgmt = baseDays * assocCoeff * flowCoeff
          }

          // 乘以管理系数
          const rawWithMgmt = rawNoMgmt * (1 + managementCoefficient)

          // 单功能点工作量：保留两位小数
          const workload = roundWorkload(rawWithMgmt)

          if (workload > 0) {
            items.push({
              phase: phase.name,
              module: module.name,
              function: funcName,
              workload,
              complexity: cx
            })
            // 累加原始值（用于阶段合计的精确计算）
            phaseRawSums[phase.name] += rawWithMgmt
          }

          // 记录阶段轨迹
          trace.phases[phase.name] = {
            flow_coeff: flowCoeff,
            uses_tech_stack: phase.usesTechStack,
            raw: Math.round(rawWithMgmt * 10000) / 10000,
            workload
          }
        }

        traces.push(trace)
      }
    }

    // 6. 阶段合计：对原始累加值取整到0.5（参考 Python 第559-562行）
    const phaseTotals: Record<string, number> = {}
    for (const phase of PHASES) {
      phaseTotals[phase.name] = roundPhaseTotal(phaseRawSums[phase.name])
    }

    // 7. 投产上线计算（参考 Python 第564-567行）
    // 投产上线 = Σ(需求+UI设计+技术设计+开发+技术测试+性能测试) × go_pct
    const goLiveBase = ['需求', 'UI设计', '技术设计', '开发', '技术测试', '性能测试']
      .reduce((sum, name) => sum + (phaseTotals[name] || 0), 0)
    const goLiveDays = Math.round(goLiveBase * goLivePercentage * 100) / 100
    phaseTotals['投产上线'] = goLiveDays

    // 8. 总人天
    const totalManDay = Math.round(Object.values(phaseTotals).reduce((sum, v) => sum + v, 0) * 100) / 100

    // 构建阶段详情
    const stageDetail: StageDetail[] = Object.entries(phaseTotals).map(([name, days]) => ({
      stage: name,
      manDays: days,
      percentage: 0,
      cost: 0,
      description: `${name}阶段工作量`
    }))

    // 计算占比
    stageDetail.forEach(s => {
      s.percentage = Math.round(s.manDays / totalManDay * 10000) / 100
    })

    // ========== 团队成本计算（参考 Python calculate_team_costs）==========

    const reqDays = phaseTotals['需求'] || 0
    const uiDays = phaseTotals['UI设计'] || 0
    const techDesignDays = phaseTotals['技术设计'] || 0
    const devDays = phaseTotals['开发'] || 0
    const techTestDays = phaseTotals['技术测试'] || 0
    const perfTestDays = phaseTotals['性能测试'] || 0
    const goLiveDaysVal = phaseTotals['投产上线'] || 0

    // 产品团队 = 需求人天 × 产品经理单价
    const productCost = Math.round(reqDays * (dailyRates.product_manager || 2000) * 100) / 100

    // UI团队 = UI设计人天 × UI设计单价
    const uiCost = Math.round(uiDays * (dailyRates.ui_designer || 1800) * 100) / 100

    // 研发团队 = (技术设计+开发) × 0.4 × 前端单价 + × 0.6 × 后端单价
    const designDevTotal = techDesignDays + devDays
    const frontendDays = Math.round(designDevTotal * 0.4 * 100) / 100
    const backendDays = Math.round(designDevTotal * 0.6 * 100) / 100
    const devCost = Math.round(
      (frontendDays * (dailyRates.frontend_dev || 1800) +
       backendDays * (dailyRates.backend_dev || 2000)) * 100
    ) / 100

    // 测试团队 = 技术测试 × 功能测试单价 + 性能测试 × 性能测试单价
    const testCost = Math.round(
      (techTestDays * (dailyRates.func_tester || 1500) +
       perfTestDays * (dailyRates.perf_tester || 2000)) * 100
    ) / 100

    // 项目管理 = (go_live_base × mgmt_coeff + go_live) × PM单价
    // 参考 Python 第623行
    const pmDays = Math.round((goLiveBase * managementCoefficient + goLiveDaysVal) * 100) / 100
    const pmCost = Math.round(pmDays * (dailyRates.project_manager || 2000) * 100) / 100

    const totalCost = Math.round((productCost + uiCost + devCost + testCost + pmCost) * 100) / 100
    const manMonth = Math.round(totalManDay / 21.75 * 100) / 100

    const teamDetail: TeamDetail[] = [
      { level: '产品团队', count: 1, dailyCost: dailyRates.product_manager || 2000, totalCost: productCost, manDays: Math.round(reqDays * 100) / 100 },
      { level: 'UI团队', count: 1, dailyCost: dailyRates.ui_designer || 1800, totalCost: uiCost, manDays: Math.round(uiDays * 100) / 100 },
      { level: '研发团队', count: Math.round(frontendDays + backendDays), dailyCost: 0, totalCost: devCost, manDays: Math.round(designDevTotal * 100) / 100 },
      { level: '测试团队', count: 1, dailyCost: 0, totalCost: testCost, manDays: Math.round((techTestDays + perfTestDays) * 100) / 100 },
      { level: '项目管理', count: 1, dailyCost: dailyRates.project_manager || 2000, totalCost: pmCost, manDays: pmDays }
    ]

    // 计算每个阶段的成本
    stageDetail.forEach(s => {
      s.cost = Math.round(s.manDays / totalManDay * totalCost * 100) / 100
    })

    // ========== 合规校验（参考 Python validate_compliance）==========

    const complianceDetails: Record<string, any> = {}
    const checkPhases = ['需求', '设计', '开发', '技术测试', '性能测试', '投产上线']

    // 设计阶段需要合并 UI设计 + 技术设计
    const designDays = (phaseTotals['UI设计'] || 0) + (phaseTotals['技术设计'] || 0)

    const checkMap: Record<string, number> = {
      '需求': reqDays,
      '设计': designDays,
      '开发': devDays,
      '技术测试': techTestDays,
      '性能测试': perfTestDays,
      '投产上线': goLiveDaysVal
    }

    const checkTotal = Object.values(checkMap).reduce((sum, v) => sum + v, 0)

    for (const phaseName of checkPhases) {
      const days = checkMap[phaseName] || 0
      const pct = Math.round(days / checkTotal * 1000) / 10
      const [minPct, maxPct] = COMPLIANCE_RANGES[phaseName] || [0, 100]
      const passed = minPct <= pct && pct <= maxPct

      complianceDetails[phaseName] = {
        pass: passed,
        days: Math.round(days * 100) / 100,
        pct,
        min: minPct,
        max: maxPct
      }
    }

    const allPass = Object.values(complianceDetails).every((d: any) => d.pass)
    const compliance = {
      all_pass: allPass,
      details: complianceDetails
    }

    // 添加计算轨迹
    calcTrace.push({
      step: '基础工作量计算',
      input: { modules: parseResult.modules.map(m => m.name), complexityConfig },
      output: { items: items.length },
      formula: 'Σ(基准 × 关联度 × 流程系数 × [技术栈]) × (1 + 管理系数)'
    })

    calcTrace.push({
      step: '阶段分解',
      input: { totalManDay, phases: PHASES.map(p => p.name) },
      output: { stageDetail }
    })

    calcTrace.push({
      step: '团队成本计算',
      input: { teamConfig: teamDetail.map(t => t.level), dailyRates, totalManDay },
      output: { teamDetail, totalCost }
    })

    calcTrace.push({
      step: '合规校验',
      input: { stageDetail, complianceRanges: COMPLIANCE_RANGES },
      output: { compliance }
    })

    // 保存结果
    const existingResult = await prisma.estimateResult.findFirst({
      where: { projectId: Number(projectId) }
    })

    const resultData = {
      totalManDay,
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
      totalManDay,
      totalCost,
      moduleCount: parseResult.totalModules,
      manMonth,
      stageDetail,
      teamDetail,
      calcTrace,
      traces,       // 新增：详细功能点计算轨迹
      compliance,   // 新增：合规校验结果
      totalItems: items.length
    }

    console.log(`[Calculate] 计算完成: 总人天=${totalManDay}, 总成本=${totalCost}万元, 合规=${allPass ? '通过' : '存在异常'}`)

    sendResponse(res, response, '工作量计算成功')
  } catch (error) {
    console.error('Calculate error:', error)
    sendError(res, 500, '工作量计算失败')
  }
})

/**
 * GET /:projectId/parse-result - 获取文档解析结果
 */
router.get('/:projectId/parse-result', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const { projectId } = req.params
    const userId = authReq.userId

    if (!await verifyProjectOwnership(Number(projectId), userId)) {
      return sendError(res, 403, '无权访问该项目')
    }

    const document = await prisma.projectDocument.findFirst({
      where: { projectId: Number(projectId) }
    })

    if (!document) {
      return sendError(res, 404, '未找到项目文档')
    }

    // 如果文档尚未解析，返回待解析状态而不是404错误
    if (!document.parseResult) {
      sendResponse(res, {
        documentId: document.id,
        parseStatus: document.parseStatus || 'pending',
        parseResult: null
      }, '文档尚未解析')
      return
    }

    const parseResult: ParseResult = JSON.parse(document.parseResult)

    sendResponse(res, {
      documentId: document.id,
      parseStatus: document.parseStatus,
      parseResult
    }, '获取解析结果成功')
  } catch (error) {
    console.error('Get parse result error:', error)
    sendError(res, 500, '获取解析结果失败')
  }
})

/**
 * PUT /:projectId/parse-result - 更新解析结果（功能点编辑）
 */
router.put('/:projectId/parse-result', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const { projectId } = req.params
    const userId = authReq.userId
    const { modules } = req.body

    if (!await verifyProjectOwnership(Number(projectId), userId)) {
      return sendError(res, 403, '无权访问该项目')
    }

    const document = await prisma.projectDocument.findFirst({
      where: { projectId: Number(projectId) }
    })

    if (!document) {
      return sendError(res, 404, '未找到项目文档')
    }

    // 获取现有解析结果
    const existingResult: ParseResult = document.parseResult ? JSON.parse(document.parseResult) : { modules: [], totalModules: 0 }

    // 更新模块数据（保留完整的功能点信息：name, complexity, association_systems）
    const updatedModules: ModuleInfo[] = modules.map((m: any) => {
      const existingModule = existingResult.modules.find((em: any) => em.name === m.name)
      return {
        name: m.name,
        description: m.description || existingModule?.description || '',
        features: m.functions.map((f: any) => f.name),
        // 关键：保存完整的 functions 数组，包含 complexity 和 association_systems
        functions: m.functions.map((f: any) => ({
          name: f.name,
          complexity: f.complexity || 'medium',
          association_systems: f.association_systems || 1
        })),
        complexity: m.functions.length > 0 ? mapComplexity(m.functions[0].complexity) : 'medium',
        associationSystems: m.functions.length > 0 ? m.functions[0].association_systems || 1 : 1
      }
    })

    const updatedParseResult: ParseResult = {
      ...existingResult,
      modules: updatedModules,
      totalModules: updatedModules.length
    }

    // 更新数据库
    await prisma.projectDocument.update({
      where: { id: document.id },
      data: {
        parseResult: JSON.stringify(updatedParseResult)
      }
    })

    sendResponse(res, { parseResult: updatedParseResult }, '解析结果更新成功')
  } catch (error) {
    console.error('Update parse result error:', error)
    sendError(res, 500, '更新解析结果失败')
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

// ==================== Excel 导出辅助函数 ====================

// 阶段颜色配置
const PHASE_BG: Record<string, string> = {
  '需求': 'EBF3FB',
  'UI设计': 'FFF9C4',
  '技术设计': 'E3F2FD',
  '开发': 'E2EFDA',
  '技术测试': 'FCE4D6',
  '性能测试': 'EDEDED',
  '投产上线': 'F3E5F5'
}

// 阶段描述
const PHASE_DESC: Record<string, string> = {
  '需求': '根据需求文档，配合业务开展技术调研、需求评审。',
  'UI设计': '根据业务需求进行交互设计、视觉稿输出及评审。',
  '技术设计': '根据业务需求进行详细技术设计、数据模型设计。',
  '开发': '根据详细设计进行编码开发，含代码审查及单元测试。',
  '技术测试': '编写技术测试方案，执行测试，提交缺陷并跟踪闭环。',
  '性能测试': '制定性能测试方案，执行压力与负载测试，分析优化。',
  '投产上线': '上线部署，生产环境功能验证，提供上线技术支持。'
}

/**
 * 合规校验计算
 */
function validateCompliance(stageDetail: StageDetail[], totalDays: number): {
  allPass: boolean
  details: Record<string, { days: number; pct: number; min: number; max: number; pass: boolean }>
} {
  // 合规区间配置（占总人天百分比）
  const complianceRanges: Record<string, [number, number]> = {
    '需求': [12, 18],
    '设计': [12, 20],
    '开发': [30, 40],
    '技术测试': [15, 25],
    '性能测试': [0, 12],
    '投产上线': [2, 2]
  }

  // 合规校验分母 = 仅被校验阶段的合计
  const checkStages = ['需求', 'UI设计', '技术设计', '开发', '技术测试', '性能测试', '投产上线']
  let checkTotal = 0

  // 合并UI设计和技术设计为"设计"
  const uiDays = stageDetail.find(s => s.stage === 'UI设计')?.manDays || 0
  const techDesignDays = stageDetail.find(s => s.stage === '技术设计')?.manDays || 0
  const designDays = uiDays + techDesignDays

  // 计算合规校验分母
  for (const stage of checkStages) {
    if (stage === 'UI设计' || stage === '技术设计') continue
    const days = stageDetail.find(s => s.stage === stage)?.manDays || 0
    checkTotal += days
  }
  checkTotal += designDays // 添加合并的设计天数

  const details: Record<string, { days: number; pct: number; min: number; max: number; pass: boolean }> = {}

  // 需求阶段
  const reqDays = stageDetail.find(s => s.stage === '需求')?.manDays || 0
  const reqPct = Math.round(reqDays / checkTotal * 1000) / 10
  details['需求'] = {
    days: Math.round(reqDays * 100) / 100,
    pct: reqPct,
    min: complianceRanges['需求'][0],
    max: complianceRanges['需求'][1],
    pass: reqPct >= complianceRanges['需求'][0] && reqPct <= complianceRanges['需求'][1]
  }

  // 设计阶段（合并UI设计+技术设计）
  const designPct = Math.round(designDays / checkTotal * 1000) / 10
  details['设计'] = {
    days: Math.round(designDays * 100) / 100,
    pct: designPct,
    min: complianceRanges['设计'][0],
    max: complianceRanges['设计'][1],
    pass: designPct >= complianceRanges['设计'][0] && designPct <= complianceRanges['设计'][1]
  }

  // 开发阶段
  const devDays = stageDetail.find(s => s.stage === '开发')?.manDays || 0
  const devPct = Math.round(devDays / checkTotal * 1000) / 10
  details['开发'] = {
    days: Math.round(devDays * 100) / 100,
    pct: devPct,
    min: complianceRanges['开发'][0],
    max: complianceRanges['开发'][1],
    pass: devPct >= complianceRanges['开发'][0] && devPct <= complianceRanges['开发'][1]
  }

  // 技术测试
  const techTestDays = stageDetail.find(s => s.stage === '技术测试')?.manDays || 0
  const techTestPct = Math.round(techTestDays / checkTotal * 1000) / 10
  details['技术测试'] = {
    days: Math.round(techTestDays * 100) / 100,
    pct: techTestPct,
    min: complianceRanges['技术测试'][0],
    max: complianceRanges['技术测试'][1],
    pass: techTestPct >= complianceRanges['技术测试'][0] && techTestPct <= complianceRanges['技术测试'][1]
  }

  // 性能测试
  const perfTestDays = stageDetail.find(s => s.stage === '性能测试')?.manDays || 0
  const perfTestPct = Math.round(perfTestDays / checkTotal * 1000) / 10
  details['性能测试'] = {
    days: Math.round(perfTestDays * 100) / 100,
    pct: perfTestPct,
    min: complianceRanges['性能测试'][0],
    max: complianceRanges['性能测试'][1],
    pass: perfTestPct >= complianceRanges['性能测试'][0] && perfTestPct <= complianceRanges['性能测试'][1]
  }

  // 投产上线
  const goLiveDays = stageDetail.find(s => s.stage === '投产上线')?.manDays || 0
  const goLivePct = Math.round(goLiveDays / checkTotal * 1000) / 10
  details['投产上线'] = {
    days: Math.round(goLiveDays * 100) / 100,
    pct: goLivePct,
    min: complianceRanges['投产上线'][0],
    max: complianceRanges['投产上线'][1],
    pass: goLivePct >= complianceRanges['投产上线'][0] && goLivePct <= complianceRanges['投产上线'][1]
  }

  const allPass = Object.values(details).every(d => d.pass)

  return { allPass, details }
}

/**
 * 生成Excel报告（参考Python实现）
 * @param workItemDescriptions AI生成的阶段-功能工作项描述映射
 */
async function generateExcelReport(
  project: { projectName: string },
  result: {
    totalManDay: number
    totalCost: number
    moduleCount: number
    manMonth: number
    stageDetail: StageDetail[]
    teamDetail: TeamDetail[]
    calcTrace: CalcTraceItem[]
  },
  document: { parseResult: string },
  config: { complexityConfig: string | null; unitPriceConfig: string | null; managementCoefficient: number } | null,
  workItemDescriptions?: Record<string, Record<string, string>>
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'IT项目成本估算系统'

  const stageDetail = result.stageDetail
  const teamDetail = result.teamDetail
  const totalDays = result.totalManDay
  const totalMonths = result.manMonth

  // 解析项目名称和系统名称
  let projectName = project.projectName
  let systemName = ''
  let modules: any[] = []
  try {
    const parseResult: ParseResult = JSON.parse(document.parseResult)
    projectName = parseResult.projectName || project.projectName
    systemName = parseResult.systemName || ''
    modules = parseResult.modules || []
  } catch (e) {
    // ignore
  }

  // 解析配置
  const complexityConfig = config ? JSON.parse(config.complexityConfig || '{}') : DEFAULT_COMPLEXITY_CONFIG
  const dailyRates = config ? JSON.parse(config.unitPriceConfig || '{}') : DEFAULT_DAILY_RATES
  const mgmtCoeff = config?.managementCoefficient || DEFAULT_MANAGEMENT_COEFFICIENT

  // 合规校验
  const compliance = validateCompliance(stageDetail, totalDays)

  // 颜色定义
  const HBG = 'BDD7EE'  // 表头背景
  const IBG = 'D9E1F2'  // 信息行背景
  const HEADER_BLUE = '4472C4'  // 主标题蓝色

  // ── Sheet 1: 填写说明 ──
  const ws1 = workbook.addWorksheet('填写说明')
  ws1.getColumn('B').width = 90

  // 标题行
  ws1.mergeCells('B2:M2')
  const titleCell = ws1.getCell('B2')
  titleCell.value = '表格说明'
  titleCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFF' } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BLUE } }
  titleCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
  ws1.getRow(2).height = 28

  // 说明内容
  const note = [
    '1. 项目工作量评估表：项目类型涉及实施类项目时需要填写的工作量，工作量内容仅为科技侧工作量，不含业务侧工作量。',
    '2. 成本汇总表：各团队（产品/UI/研发/测试/项目管理）的人天与成本汇总。',
    '3. 合规校验表：各阶段工作量占比是否符合行业标准区间。',
    '4. 产品采购评估表：项目类型涉及产品项目时需要填写。',
    '5. 计算参数：本次评估使用的所有系数参数，支持追溯。'
  ].join('\n')

  ws1.mergeCells('B3:M7')
  const noteCell = ws1.getCell('B3')
  noteCell.value = note
  noteCell.font = { name: 'Arial', size: 10 }
  noteCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true }
  noteCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }

  for (let r = 3; r <= 7; r++) {
    ws1.getRow(r).height = 20
  }

  // ── Sheet 2: 项目工作量评估表 ──
  const ws2 = workbook.addWorksheet('项目工作量评估表')

  // 设置列宽
  ws2.getColumn(1).width = 2
  ws2.getColumn(2).width = 10
  ws2.getColumn(3).width = 20
  ws2.getColumn(4).width = 15
  ws2.getColumn(5).width = 10
  ws2.getColumn(6).width = 12
  ws2.getColumn(7).width = 12
  ws2.getColumn(8).width = 12
  ws2.getColumn(9).width = 12
  ws2.getColumn(10).width = 12
  ws2.getColumn(11).width = 12
  ws2.getColumn(12).width = 8
  ws2.getColumn(13).width = 8
  ws2.getColumn(14).width = 8
  ws2.getColumn(15).width = 30

  // 标题行
  ws2.mergeCells('B2:O2')
  const mainTitle = ws2.getCell('B2')
  mainTitle.value = '项目工作量评估表（仅为科技侧工作量）'
  mainTitle.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFF' } }
  mainTitle.alignment = { horizontal: 'center', vertical: 'middle' }
  mainTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BLUE } }
  ws2.getRow(2).height = 34

  // 项目信息行
  ws2.mergeCells('B3:D3')
  const projectInfoCell = ws2.getCell('B3')
  projectInfoCell.value = `项目编号：`
  projectInfoCell.font = { name: 'Arial', size: 10 }
  projectInfoCell.alignment = { horizontal: 'left', vertical: 'middle' }
  projectInfoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: IBG } }
  projectInfoCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }

  ws2.mergeCells('E3:K3')
  const projectNameCell = ws2.getCell('E3')
  projectNameCell.value = `项目名称：${projectName}`
  projectNameCell.font = { name: 'Arial', size: 10 }
  projectNameCell.alignment = { horizontal: 'left', vertical: 'middle' }
  projectNameCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: IBG } }
  projectNameCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }

  ws2.mergeCells('L3:O3')
  const systemNameCell = ws2.getCell('L3')
  systemNameCell.value = `系统名称：${systemName}`
  systemNameCell.font = { name: 'Arial', size: 10 }
  systemNameCell.alignment = { horizontal: 'left', vertical: 'middle' }
  systemNameCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: IBG } }
  systemNameCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
  ws2.getRow(3).height = 22

  // 表头行
  const headers = [
    { cols: 'B4', val: '项目阶段' },
    { cols: 'C4', val: '系统模块' },
    { cols: 'D4:E4', val: '功能' },
    { cols: 'F4:K4', val: '工作项描述' },
    { cols: 'L4', val: '备注' },
    { cols: 'M4', val: '工作量\n(人天)' },
    { cols: 'N4', val: '合计\n(人天)' },
    { cols: 'O4', val: '任务描述' }
  ]

  headers.forEach(h => {
    const parts = h.cols.split(':')
    const isMerge = parts.length === 2 && parts[0] !== parts[1]
    if (isMerge) {
      ws2.mergeCells(h.cols)
    }
    const cell = ws2.getCell(parts[0])
    cell.value = h.val
    cell.font = { name: 'Arial', size: 10, bold: true }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HBG } }
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
  })
  ws2.getRow(4).height = 34

  // 数据行 - 按阶段分组
  const organizedData: Record<string, Record<string, { function: string; workload: number }[]>> = {}

  // 从模块生成详细数据
  for (const module of modules) {
    const features = module.features || [module.name]
    for (const phase of PHASES) {
      const phaseName = phase.name
      const stageInfo = stageDetail.find(s => s.stage === phaseName)
      if (!stageInfo || stageInfo.manDays <= 0) continue

      // 计算该阶段该模块的工作量
      const complexity = (module.complexity || 'medium').toLowerCase()
      const baseDays = complexityConfig[complexity] || complexityConfig['medium'] || 1.5
      const associationSystems = (module as any).associationSystems || 1
      const assocCoeff = getAssociationCoefficient(associationSystems)
      const flowCoeff = DEFAULT_FLOW_COEFFICIENTS[phase.key] || 0
      let rawDays = baseDays * assocCoeff * flowCoeff
      if (phase.usesTechStack) rawDays *= DEFAULT_TECH_STACK_COEFFICIENT
      const daysWithMgmt = rawDays * (1 + mgmtCoeff)
      const workload = Math.round(daysWithMgmt * 100) / 100

      if (!organizedData[phaseName]) organizedData[phaseName] = {}
      if (!organizedData[phaseName][module.name]) organizedData[phaseName][module.name] = []

      for (const featureName of features) {
        organizedData[phaseName][module.name].push({
          function: typeof featureName === 'string' ? featureName : featureName,
          workload: workload / features.length // 分摊到每个功能
        })
      }
    }
  }

  let row = 5
  for (const phaseName of ['需求', 'UI设计', '技术设计', '开发', '技术测试', '性能测试']) {
    if (!organizedData[phaseName]) continue

    const bg = PHASE_BG[phaseName] || 'FFFFFF'
    const phaseModules = organizedData[phaseName]

    // 检查该阶段是否有实际数据
    const phaseModuleKeys = Object.keys(phaseModules)
    if (phaseModuleKeys.length === 0) continue

    const phaseStart = row

    for (const moduleName of phaseModuleKeys) {
      const items = phaseModules[moduleName]
      const moduleStart = row

      for (const item of items) {
        ws2.getRow(row).height = 18

        // 模块名（仅在第一个功能点显示）
        if (row === moduleStart) {
          const moduleCell = ws2.getCell(`C${row}`)
          moduleCell.value = moduleName
          moduleCell.font = { name: 'Arial', size: 9 }
          moduleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
          moduleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
          moduleCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
        }

        // 功能名
        ws2.mergeCells(`D${row}:E${row}`)
        const funcCell = ws2.getCell(`D${row}`)
        funcCell.value = item.function
        funcCell.font = { name: 'Arial', size: 9 }
        funcCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
        funcCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
        funcCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }

        // 工作项描述 - 优先使用AI生成的描述
        ws2.mergeCells(`F${row}:K${row}`)
        const descCell = ws2.getCell(`F${row}`)
        // 获取AI生成的描述：格式为 "模块名 - 功能名"
        const aiDesc = workItemDescriptions?.[phaseName]?.[`${moduleName} - ${item.function}`]
        descCell.value = aiDesc || PHASE_DESC[phaseName] || ''
        descCell.font = { name: 'Arial', size: 9 }
        descCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
        descCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
        descCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }

        // 备注
        const remarkCell = ws2.getCell(`L${row}`)
        remarkCell.value = ''
        remarkCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
        remarkCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }

        // 工作量
        const wlCell = ws2.getCell(`M${row}`)
        wlCell.value = Math.round(item.workload * 100) / 100
        wlCell.font = { name: 'Arial', size: 9 }
        wlCell.alignment = { horizontal: 'center', vertical: 'middle' }
        wlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
        wlCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
        wlCell.numFmt = '#,##0.00'

        row++
      }
    }

    const phaseEnd = row - 1

    // 确保有有效的范围才进行合并
    if (phaseEnd >= phaseStart) {
      // 阶段名
      ws2.mergeCells(`B${phaseStart}:B${phaseEnd}`)
      const phaseCell = ws2.getCell(`B${phaseStart}`)
      phaseCell.value = phaseName
      phaseCell.font = { name: 'Arial', size: 10, bold: true }
      phaseCell.alignment = { horizontal: 'center', vertical: 'middle' }
      phaseCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      phaseCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }

      // 阶段合计
      ws2.mergeCells(`N${phaseStart}:N${phaseEnd}`)
      const sumCell = ws2.getCell(`N${phaseStart}`)
      sumCell.value = { formula: `SUM(M${phaseStart}:M${phaseEnd})` }
      sumCell.font = { name: 'Arial', size: 10, bold: true }
      sumCell.alignment = { horizontal: 'center', vertical: 'middle' }
      sumCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      sumCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
      sumCell.numFmt = '#,##0.00'

      // 任务描述
      ws2.mergeCells(`O${phaseStart}:O${phaseEnd}`)
      const taskDescCell = ws2.getCell(`O${phaseStart}`)
      taskDescCell.value = PHASE_DESC[phaseName] || ''
      taskDescCell.font = { name: 'Arial', size: 9 }
      taskDescCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true }
      taskDescCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      taskDescCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
    }
  }

  // 投产上线行
  const goLiveBg = PHASE_BG['投产上线'] || 'F3E5F5'
  const goLiveStage = stageDetail.find(s => s.stage === '投产上线')
  const goLiveDays = goLiveStage?.manDays || 0

  ws2.mergeCells(`B${row}:M${row}`)
  const goLiveTitle = ws2.getCell(`B${row}`)
  goLiveTitle.value = `投产上线（以上阶段合计 × ${Math.round(DEFAULT_GO_LIVE_PERCENTAGE * 100)}%）`
  goLiveTitle.font = { name: 'Arial', size: 10, bold: true }
  goLiveTitle.alignment = { horizontal: 'left', vertical: 'middle' }
  goLiveTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: goLiveBg } }
  goLiveTitle.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }

  const goLiveSumCell = ws2.getCell(`N${row}`)
  goLiveSumCell.value = goLiveDays
  goLiveSumCell.font = { name: 'Arial', size: 10, bold: true }
  goLiveSumCell.alignment = { horizontal: 'center', vertical: 'middle' }
  goLiveSumCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: goLiveBg } }
  goLiveSumCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
  goLiveSumCell.numFmt = '#,##0.00'

  const goLiveDescCell = ws2.getCell(`O${row}`)
  goLiveDescCell.value = '上线部署及技术支持'
  goLiveDescCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: goLiveBg } }
  goLiveDescCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }

  row++

  // 总计行
  ws2.mergeCells(`B${row}:C${row}`)
  const totalTitleCell = ws2.getCell(`B${row}`)
  totalTitleCell.value = '总计（人天）'
  totalTitleCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } }
  totalTitleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  totalTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BLUE } }
  totalTitleCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }

  ws2.mergeCells(`D${row}:O${row}`)
  const totalValueCell = ws2.getCell(`D${row}`)
  totalValueCell.value = totalDays
  totalValueCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } }
  totalValueCell.alignment = { horizontal: 'center', vertical: 'middle' }
  totalValueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BLUE } }
  totalValueCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
  totalValueCell.numFmt = '#,##0.00'
  ws2.getRow(row).height = 24

  row++

  // 人月行
  ws2.mergeCells(`B${row}:C${row}`)
  const monthTitleCell = ws2.getCell(`B${row}`)
  monthTitleCell.value = '总计（人月）'
  monthTitleCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } }
  monthTitleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  monthTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BLUE } }
  monthTitleCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }

  ws2.mergeCells(`D${row}:O${row}`)
  const monthValueCell = ws2.getCell(`D${row}`)
  monthValueCell.value = totalMonths
  monthValueCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } }
  monthValueCell.alignment = { horizontal: 'center', vertical: 'middle' }
  monthValueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BLUE } }
  monthValueCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
  monthValueCell.numFmt = '#,##0.00'
  ws2.getRow(row).height = 24

  // ── Sheet 3: 成本汇总表 ──
  const ws3 = workbook.addWorksheet('成本汇总表')
  ws3.getColumn('B').width = 18
  ws3.getColumn('C').width = 14
  ws3.getColumn('D').width = 14
  ws3.getColumn('E').width = 20
  ws3.getColumn('F').width = 20

  // 标题
  ws3.mergeCells('B1:F1')
  const costTitle = ws3.getCell('B1')
  costTitle.value = '项目团队成本汇总表'
  costTitle.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFF' } }
  costTitle.alignment = { horizontal: 'center', vertical: 'middle' }
  costTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BLUE } }
  ws3.getRow(1).height = 30

  // 项目信息
  ws3.mergeCells('B2:F2')
  const costProjectInfo = ws3.getCell('B2')
  costProjectInfo.value = `项目：${projectName}  |  系统：${systemName}`
  costProjectInfo.font = { name: 'Arial', size: 10 }
  costProjectInfo.alignment = { horizontal: 'left', vertical: 'middle' }
  costProjectInfo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: IBG } }

  // 表头
  const costHeaders = ['团队', '工作量（人天）', '单价（元/天）', '成本（元）', '说明']
  costHeaders.forEach((h, i) => {
    const cell = ws3.getCell(3, i + 2)
    cell.value = h
    cell.font = { name: 'Arial', size: 10, bold: true }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HBG } }
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
  })
  ws3.getRow(3).height = 22

  // 成本数据
  const costRows = [
    { label: '产品团队', days: teamDetail[0]?.manDays || 0, rate: dailyRates.product_manager || 2000, cost: teamDetail[0]?.totalCost || 0, note: '需求分析阶段' },
    { label: 'UI团队', days: teamDetail[1]?.manDays || 0, rate: dailyRates.ui_designer || 1800, cost: teamDetail[1]?.totalCost || 0, note: 'UI/UX设计阶段' },
    { label: '研发团队', days: teamDetail[2]?.manDays || 0, rate: '前端/后端混合', cost: teamDetail[2]?.totalCost || 0, note: '前端+后端混合' },
    { label: '测试团队', days: teamDetail[3]?.manDays || 0, rate: '功能/性能混合', cost: teamDetail[3]?.totalCost || 0, note: '技术测试+性能测试' },
    { label: '项目管理', days: teamDetail[4]?.manDays || 0, rate: dailyRates.project_manager || 2000, cost: teamDetail[4]?.totalCost || 0, note: `管理系数${Math.round(mgmtCoeff * 100)}%+投产` }
  ]

  costRows.forEach((r, i) => {
    const rowIdx = i + 4
    const bg = i % 2 === 0 ? 'F8FAFC' : 'FFFFFF'

    ws3.getCell(rowIdx, 2).value = r.label
    ws3.getCell(rowIdx, 2).font = { name: 'Arial', size: 10, bold: true }
    ws3.getCell(rowIdx, 2).alignment = { horizontal: 'left', vertical: 'middle' }
    ws3.getCell(rowIdx, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
    ws3.getCell(rowIdx, 2).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }

    ws3.getCell(rowIdx, 3).value = Math.round(r.days * 100) / 100
    ws3.getCell(rowIdx, 3).alignment = { horizontal: 'center', vertical: 'middle' }
    ws3.getCell(rowIdx, 3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
    ws3.getCell(rowIdx, 3).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
    ws3.getCell(rowIdx, 3).numFmt = '#,##0.00'

    ws3.getCell(rowIdx, 4).value = r.rate
    ws3.getCell(rowIdx, 4).alignment = { horizontal: 'left', vertical: 'middle' }
    ws3.getCell(rowIdx, 4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
    ws3.getCell(rowIdx, 4).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }

    ws3.getCell(rowIdx, 5).value = Math.round(r.cost * 100) / 100
    ws3.getCell(rowIdx, 5).alignment = { horizontal: 'center', vertical: 'middle' }
    ws3.getCell(rowIdx, 5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
    ws3.getCell(rowIdx, 5).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
    ws3.getCell(rowIdx, 5).numFmt = '#,##0.00'

    ws3.getCell(rowIdx, 6).value = r.note
    ws3.getCell(rowIdx, 6).font = { name: 'Arial', size: 9 }
    ws3.getCell(rowIdx, 6).alignment = { horizontal: 'left', vertical: 'middle' }
    ws3.getCell(rowIdx, 6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
    ws3.getCell(rowIdx, 6).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }

    ws3.getRow(rowIdx).height = 20
  })

  // 总成本行
  const totalCostRow = costRows.length + 4
  ws3.mergeCells(`B${totalCostRow}:D${totalCostRow}`)
  const totalCostTitle = ws3.getCell(`B${totalCostRow}`)
  totalCostTitle.value = '项目总成本'
  totalCostTitle.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } }
  totalCostTitle.alignment = { horizontal: 'center', vertical: 'middle' }
  totalCostTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BLUE } }
  totalCostTitle.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }

  ws3.mergeCells(`E${totalCostRow}:F${totalCostRow}`)
  const totalCostValue = ws3.getCell(`E${totalCostRow}`)
  totalCostValue.value = result.totalCost
  totalCostValue.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } }
  totalCostValue.alignment = { horizontal: 'center', vertical: 'middle' }
  totalCostValue.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BLUE } }
  totalCostValue.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
  totalCostValue.numFmt = '#,##0.00'
  ws3.getRow(totalCostRow).height = 26

  // ── Sheet 4: 合规校验报告 ──
  const ws4 = workbook.addWorksheet('合规校验报告')
  ws4.getColumn('B').width = 14
  ws4.getColumn('C').width = 12
  ws4.getColumn('D').width = 10
  ws4.getColumn('E').width = 10
  ws4.getColumn('F').width = 10
  ws4.getColumn('G').width = 12
  ws4.getColumn('H').width = 16

  // 标题
  ws4.mergeCells('B1:H1')
  const complianceTitle = ws4.getCell('B1')
  complianceTitle.value = '各阶段工作量合规校验报告'
  complianceTitle.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFF' } }
  complianceTitle.alignment = { horizontal: 'center', vertical: 'middle' }
  complianceTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BLUE } }
  ws4.getRow(1).height = 30

  // 总体结果
  const overallBg = compliance.allPass ? '4CAF50' : 'FF9800'
  const overallText = compliance.allPass ? '✅ 全部通过' : '⚠️ 存在超出区间'
  ws4.mergeCells('B2:H2')
  const overallCell = ws4.getCell('B2')
  overallCell.value = `总体结果：${overallText}  （总计 ${totalDays} 人天 / ${totalMonths} 人月）`
  overallCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFF' } }
  overallCell.alignment = { horizontal: 'left', vertical: 'middle' }
  overallCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: overallBg } }

  // 表头
  const complianceHeaders = ['阶段', '人天', '占比%', '最低%', '最高%', '结果', '备注']
  complianceHeaders.forEach((h, i) => {
    const cell = ws4.getCell(3, i + 2)
    cell.value = h
    cell.font = { name: 'Arial', size: 10, bold: true }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HBG } }
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
  })
  ws4.getRow(3).height = 22

  // 合规数据
  Object.entries(compliance.details).forEach(([phase, detail], i) => {
    const rowIdx = i + 4
    const passed = detail.pass
    const bg = passed ? 'F1F8E9' : 'FFF3E0'
    const resultText = passed ? '✅ 通过' : '⚠️ 超出区间'
    const noteText = passed ? '' : `实际${detail.pct}%，区间[${detail.min}%，${detail.max}%]`
    const textColor = passed ? '166534' : 'B45309'

    ws4.getCell(rowIdx, 2).value = phase
    ws4.getCell(rowIdx, 2).font = { name: 'Arial', size: 10, bold: true }
    ws4.getCell(rowIdx, 2).alignment = { horizontal: 'left', vertical: 'middle' }
    ws4.getCell(rowIdx, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
    ws4.getCell(rowIdx, 2).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }

    ws4.getCell(rowIdx, 3).value = detail.days
    ws4.getCell(rowIdx, 3).alignment = { horizontal: 'center', vertical: 'middle' }
    ws4.getCell(rowIdx, 3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
    ws4.getCell(rowIdx, 3).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
    ws4.getCell(rowIdx, 3).numFmt = '#,##0.00'

    ws4.getCell(rowIdx, 4).value = detail.pct
    ws4.getCell(rowIdx, 4).alignment = { horizontal: 'center', vertical: 'middle' }
    ws4.getCell(rowIdx, 4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
    ws4.getCell(rowIdx, 4).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
    ws4.getCell(rowIdx, 4).numFmt = '0.0'

    ws4.getCell(rowIdx, 5).value = detail.min
    ws4.getCell(rowIdx, 5).alignment = { horizontal: 'center', vertical: 'middle' }
    ws4.getCell(rowIdx, 5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
    ws4.getCell(rowIdx, 5).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }

    ws4.getCell(rowIdx, 6).value = detail.max
    ws4.getCell(rowIdx, 6).alignment = { horizontal: 'center', vertical: 'middle' }
    ws4.getCell(rowIdx, 6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
    ws4.getCell(rowIdx, 6).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }

    ws4.getCell(rowIdx, 7).value = resultText
    ws4.getCell(rowIdx, 7).font = { name: 'Arial', size: 10, color: { argb: textColor } }
    ws4.getCell(rowIdx, 7).alignment = { horizontal: 'center', vertical: 'middle' }
    ws4.getCell(rowIdx, 7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
    ws4.getCell(rowIdx, 7).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }

    ws4.getCell(rowIdx, 8).value = noteText
    ws4.getCell(rowIdx, 8).font = { name: 'Arial', size: 9 }
    ws4.getCell(rowIdx, 8).alignment = { horizontal: 'left', vertical: 'middle' }
    ws4.getCell(rowIdx, 8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
    ws4.getCell(rowIdx, 8).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }

    ws4.getRow(rowIdx).height = 20
  })

  // ── Sheet 5: 计算参数 ──
  const ws5 = workbook.addWorksheet('计算参数')
  ws5.getColumn('B').width = 22
  ws5.getColumn('C').width = 18
  ws5.getColumn('D').width = 28

  // 标题
  ws5.mergeCells('B1:D1')
  const paramTitle = ws5.getCell('B1')
  paramTitle.value = '本次评估计算参数'
  paramTitle.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFF' } }
  paramTitle.alignment = { horizontal: 'center', vertical: 'middle' }
  paramTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BLUE } }
  ws5.getRow(1).height = 28

  // 表头
  const paramHeaders = ['参数名称', '参数值', '说明']
  paramHeaders.forEach((h, i) => {
    const cell = ws5.getCell(2, i + 2)
    cell.value = h
    cell.font = { name: 'Arial', size: 10, bold: true }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HBG } }
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
  })

  // 参数数据
  const paramRows = [
    ['系统关联度系数', DEFAULT_ASSOCIATION_COEFFICIENT, '关联系统数量决定取值(1/1.5/2/3)'],
    ['技术栈难度系数', DEFAULT_TECH_STACK_COEFFICIENT, '常规1.0/微服务1.3/AI中台1.4/分布式1.6'],
    ['管理系数', mgmtCoeff, '小型团队≤10人: 0.15; 中型0.20; 大型0.25'],
    ['投产上线比例', `${Math.round(DEFAULT_GO_LIVE_PERCENTAGE * 100)}%`, '前置阶段合计 × 该系数'],
    ['需求流程系数', DEFAULT_FLOW_COEFFICIENTS['requirements'], ''],
    ['UI设计流程系数', DEFAULT_FLOW_COEFFICIENTS['ui_design'], ''],
    ['技术设计流程系数', DEFAULT_FLOW_COEFFICIENTS['tech_design'], ''],
    ['开发流程系数', DEFAULT_FLOW_COEFFICIENTS['development'], ''],
    ['技术测试流程系数', DEFAULT_FLOW_COEFFICIENTS['tech_testing'], ''],
    ['性能测试流程系数', DEFAULT_FLOW_COEFFICIENTS['perf_testing'], ''],
    ['较为基础复杂度基准', complexityConfig['very_basic'] || 0.5, '人天'],
    ['基础复杂度基准', complexityConfig['basic'] || 1.0, '人天'],
    ['中等复杂度基准', complexityConfig['medium'] || 1.5, '人天'],
    ['复杂复杂度基准', complexityConfig['complex'] || 2.0, '人天'],
    ['极复杂复杂度基准', complexityConfig['very_complex'] || 2.5, '人天'],
    ['产品经理单价', dailyRates['product_manager'] || 2000, '元/人天'],
    ['UI设计单价', dailyRates['ui_designer'] || 1800, '元/人天'],
    ['前端开发单价', dailyRates['frontend_dev'] || 1800, '元/人天'],
    ['后端开发单价', dailyRates['backend_dev'] || 2000, '元/人天'],
    ['功能测试单价', dailyRates['func_tester'] || 1500, '元/人天'],
    ['性能测试单价', dailyRates['perf_tester'] || 2000, '元/人天'],
    ['项目经理单价', dailyRates['project_manager'] || 2000, '元/人天']
  ]

  paramRows.forEach((r, i) => {
    const rowIdx = i + 3
    const bg = i % 2 === 0 ? 'F8FAFC' : 'FFFFFF'

    ws5.getCell(rowIdx, 2).value = r[0]
    ws5.getCell(rowIdx, 2).alignment = { horizontal: 'left', vertical: 'middle' }
    ws5.getCell(rowIdx, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
    ws5.getCell(rowIdx, 2).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }

    ws5.getCell(rowIdx, 3).value = r[1]
    ws5.getCell(rowIdx, 3).alignment = { horizontal: 'center', vertical: 'middle' }
    ws5.getCell(rowIdx, 3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
    ws5.getCell(rowIdx, 3).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }

    ws5.getCell(rowIdx, 4).value = r[2]
    ws5.getCell(rowIdx, 4).font = { name: 'Arial', size: 9 }
    ws5.getCell(rowIdx, 4).alignment = { horizontal: 'left', vertical: 'middle' }
    ws5.getCell(rowIdx, 4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
    ws5.getCell(rowIdx, 4).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }

    ws5.getRow(rowIdx).height = 18
  })

  // 生成Buffer
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

const DEFAULT_ASSOCIATION_COEFFICIENT = 1.0

/**
 * GET /:projectId/export - 导出Excel报告
 * 导出成功后将项目标记为已确认，并更新项目信息
 */
router.get('/:projectId/export', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const { projectId } = req.params
    const userId = authReq.userId

    console.log(`[Export] 开始导出, projectId=${projectId}, userId=${userId}`)

    if (!await verifyProjectOwnership(Number(projectId), userId)) {
      console.log(`[Export] 无权访问该项目`)
      return sendError(res, 403, '无权访问该项目')
    }

    const project = await prisma.project.findUnique({
      where: { id: Number(projectId) }
    })

    const result = await prisma.estimateResult.findFirst({
      where: { projectId: Number(projectId) },
      orderBy: { createdAt: 'desc' }
    })

    const document = await prisma.projectDocument.findFirst({
      where: { projectId: Number(projectId) }
    })

    const config = await prisma.estimateConfig.findFirst({
      where: { projectId: Number(projectId) }
    })

    console.log(`[Export] 查询结果: project=${!!project}, result=${!!result}, document=${!!document}, config=${!!config}`)

    if (!result || !project || !document) {
      console.log(`[Export] 未找到计算结果或项目信息`)
      return sendError(res, 404, '未找到计算结果或项目信息')
    }

    if (!document.parseResult) {
      console.log(`[Export] 未找到文档解析结果`)
      return sendError(res, 404, '未找到文档解析结果')
    }

    // 解析文档结果获取项目名称和模块信息
    let projectName = project.projectName
    let systemName = ''
    let modules: any[] = []
    try {
      const parseResult: ParseResult = JSON.parse(document.parseResult)
      if (parseResult.projectName) {
        projectName = parseResult.projectName
      }
      systemName = parseResult.systemName || ''
      modules = parseResult.modules || []
    } catch (e) {
      // ignore
    }

    // 调用AI生成工作项描述
    let workItemDescriptions: Record<string, Record<string, string>> = {}
    try {
      // 读取原始文档内容
      const filePath = path.join(uploadDir, document.docPath || '')
      let documentText = ''
      try {
        const text = await parseDocumentContent(filePath)
        documentText = text
      } catch (e) {
        // 如果无法读取文档，使用parseResult中的rawText
        console.log('[Export] 无法读取原始文档，使用parseResult中的rawText')
        try {
          const parseResult: ParseResult = JSON.parse(document.parseResult)
          documentText = parseResult.rawText || ''
        } catch (e2) {
          documentText = ''
        }
      }

      if (documentText && modules.length > 0) {
        // 构建模块数据格式
        const modulesForAI = modules.map(m => ({
          name: m.name,
          functions: m.features || [m.name]
        }))

        // 获取阶段列表
        const phases = PHASES.map(p => p.name)

        console.log(`[Export] 开始调用AI生成工作项描述，模块数: ${modulesForAI.length}, 文档长度: ${documentText.length}`)

        workItemDescriptions = await aiService.generateWorkItemDescriptions({
          documentText,
          projectName,
          modules: modulesForAI,
          phases
        })

        console.log(`[Export] AI生成工作项描述完成，阶段数: ${Object.keys(workItemDescriptions).length}`)
      }
    } catch (e) {
      console.error('[Export] AI生成工作项描述失败，使用默认描述:', e)
      // 失败时使用空对象，generateExcelReport会使用默认PHASE_DESC
    }

    const stageDetail: StageDetail[] = JSON.parse(result.stageDetail || '[]')
    const teamDetail: TeamDetail[] = JSON.parse(result.teamDetail || '[]')
    const calcTrace: CalcTraceItem[] = JSON.parse(result.calcTrace || '[]')

    const resultData = {
      totalManDay: result.totalManDay,
      totalCost: result.totalCost,
      moduleCount: result.moduleCount,
      manMonth: result.manMonth,
      stageDetail,
      teamDetail,
      calcTrace
    }

    // 生成Excel
    const excelBuffer = await generateExcelReport(
      project,
      resultData,
      { parseResult: document.parseResult },
      config ? {
        complexityConfig: config.complexityConfig,
        unitPriceConfig: config.unitPriceConfig,
        managementCoefficient: config.managementCoefficient
      } : null,
      workItemDescriptions
    )

    // 更新项目信息（项目名称、合同金额等）
    await prisma.project.update({
      where: { id: Number(projectId) },
      data: {
        projectName: projectName,
        contractAmount: result.totalCost,
        updatedAt: new Date()
      }
    })

    // 记录操作日志
    await prisma.operationLog.create({
      data: {
        userId,
        operationType: 'export_estimate',
        operationContent: JSON.stringify({
          projectId,
          projectName,
          totalManDay: result.totalManDay,
          totalCost: result.totalCost
        }),
        ipAddress: req.ip || null
      }
    })

    // 生成文件名
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '_').substring(0, 15)
    const fileName = `工作量评估表_${projectName}_${timestamp}.xlsx`

    // 设置响应头
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`)
    res.setHeader('X-Total-Days', String(result.totalManDay))
    res.setHeader('X-Total-Months', String(result.manMonth))
    res.setHeader('X-Total-Cost', String(result.totalCost))
    res.setHeader('X-Module-Count', String(result.moduleCount))
    res.setHeader('X-Project-Name', encodeURIComponent(projectName))
    res.setHeader('X-Project-Confirmed', 'true')

    // 发送文件
    res.send(excelBuffer)

    console.log(`[Export] 导出成功并确认项目: ${fileName}, 项目=${projectName}, 总人天=${result.totalManDay}, 总成本=${result.totalCost}`)
  } catch (error) {
    console.error('Export error:', error)
    sendError(res, 500, '导出报告失败: ' + (error instanceof Error ? error.message : '未知错误'))
  }
})

export default router