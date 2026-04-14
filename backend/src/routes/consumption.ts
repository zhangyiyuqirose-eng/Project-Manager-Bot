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
  OcrResult,
  SaveProjectInfoRequest,
  ProjectMemberInput,
  AdjustMembersRequest,
  ConsumptionResult,
  MemberCostDetail,
  AuthenticatedRequest
} from '../types'
import { aiService } from '../services/aiService'


/**
 * 修复中文项目名称乱码问题
 */
function decodeProjectName(projectName: string): string {
  try {
    // 尝试从 latin1 转换为 utf8
    const decoded = Buffer.from(projectName, 'latin1').toString('utf8')
    // 如果解码后包含乱码特征（如问号或特殊字符），则返回原项目名称
    if (decoded.includes('?') || decoded.includes('��') || decoded.includes('锟')) {
      return projectName
    }
    return decoded
  } catch {
    return projectName
  }
}

const router = Router()

// ==================== 文件上传配置 ====================

const uploadDir = path.join(process.cwd(), 'uploads', 'ocr')

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
 * 真实 OCR 识别 - 调用 Qwen/Qwen3-Omni-30B-A3B-Thinking 多模态模型
 */
const performOcrRecognition = async (filePath: string): Promise<OcrResult> => {
  console.log(`[Consumption] 开始真实OCR识别: ${filePath}`)

  // 读取图片并转换为 base64
  const imageBuffer = fs.readFileSync(filePath)
  const imageBase64 = imageBuffer.toString('base64')

  // 调用 AI 服务的 OCR 方法
  const ocrData = await aiService.recognizeOCR(imageBase64)

  return {
    projectInfo: {
      projectName: '数字化项目', // OCR 可能无法识别项目名称
      projectManager: '',
      startDate: dayjs().format('YYYY-MM-DD'),
      endDate: dayjs().add(1, 'year').format('YYYY-MM-DD'),
      status: '进行中'
    },
    memberInfo: ocrData.members?.map(m => ({
      name: m.name || '',
      level: m.level || 'P5',
      role: m.role || '',
      reportedHours: m.reportedHours || 0
    })) || [],
    // OCR 返回的财务数据
    contractAmount: ocrData.contractAmount,
    preSaleRatio: ocrData.preSaleRatio,
    taxRate: ocrData.taxRate,
    externalLaborCost: ocrData.externalLaborCost,
    externalSoftwareCost: ocrData.externalSoftwareCost,
    currentManpowerCost: ocrData.currentManpowerCost,
    rawText: '真实OCR识别结果'
  }
}

/**
 * 计算日人力成本
 */
const calculateDailyManpowerCost = async (projectId: number): Promise<number> => {
  const members = await prisma.projectMember.findMany({
    where: { projectId }
  })

  return members.reduce((sum, member) => sum + member.dailyCost, 0)
}

/**
 * 计算当前人力成本
 */
const calculateCurrentManpowerCost = async (projectId: number): Promise<number> => {
  const members = await prisma.projectMember.findMany({
    where: { projectId }
  })

  return members.reduce((sum, member) => {
    if (member.reportedHours) {
      // 假设每天工作8小时
      const workingDays = member.reportedHours / 8
      return sum + workingDays * member.dailyCost
    }
    return sum
  }, 0)
}

/**
 * 计算燃尽日期
 */
const calculateBurnoutDate = (
  availableCost: number,
  dailyManpowerCost: number,
  startDate: Date
): Date | null => {
  if (dailyManpowerCost <= 0 || availableCost <= 0) {
    return null
  }

  const availableDays = Math.floor(availableCost / dailyManpowerCost)
  return dayjs(startDate).add(availableDays, 'day').toDate()
}

// ==================== 路由定义 ====================

/**
 * GET /project/:projectCode - 根据项目编号查询项目信息
 */
router.get('/project/:projectCode', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const { projectCode } = req.params
    const userId = authReq.userId

    // 查询项目
    const project = await prisma.project.findFirst({
      where: { projectCode: String(projectCode), userId },
      include: {
        members: true,
        costs: true
      }
    })

    if (!project) {
      return sendError(res, 200, '项目不存在，请补充完整信息后保存')
    }

    // 获取成本信息
    const projectCost = project.costs[0]

    // 获取成员列表
    const members = await prisma.projectMember.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'asc' }
    })

    // 返回项目信息和人员列表
    const response = {
      projectId: project.id,
      projectCode: project.projectCode,
      projectName: project.projectName,
      projectType: project.projectType,
      status: project.status,
      contractAmount: project.contractAmount || projectCost?.contractAmount || 0,
      preSaleRatio: project.preSaleRatio || projectCost?.preSaleRatio || 0,
      taxRate: project.taxRate || projectCost?.taxRate || 0.06,
      externalLaborCost: project.externalLaborCost || projectCost?.externalLaborCost || 0,
      externalSoftwareCost: project.externalSoftwareCost || projectCost?.externalSoftwareCost || 0,
      otherCost: project.otherCost || projectCost?.otherCost || 0,
      currentManpowerCost: project.currentManpowerCost || projectCost?.currentManpowerCost || 0,
      members: members.map(m => ({
        memberId: m.id,
        name: m.name,
        department: m.department,
        level: m.level,
        dailyCost: m.dailyCost,
        role: m.role,
        entryTime: m.entryTime,
        leaveTime: m.leaveTime,
        isToEnd: m.isToEnd,
        reportedHours: m.reportedHours
      }))
    }

    sendResponse(res, response, '查询成功')
  } catch (error) {
    console.error('Query project error:', error)
    sendError(res, 500, '查询项目失败')
  }
})

/**
 * POST /save-project - 保存项目信息（支持新增和更新）
 */
router.post('/save-project', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const userId = authReq.userId
    
    // 检查用户是否存在，如果不存在则创建默认用户
    let existingUser = await prisma.user.findFirst({ where: { id: userId } })
    if (!existingUser) {
      // 创建默认用户
      existingUser = await prisma.user.create({
        data: {
          username: 'admin',
          passwordHash: '$2a$10$e4R0K8i6hP5vK7q3l4z5aO8jN9kM0nP1oQ2rS3tU4vW5xY6',
          name: '管理员',
          role: 'pm',
          status: 'active'
        }
      })
      console.log('创建默认用户:', existingUser)
    }

    const {
      projectCode,
      projectName,
      contractAmount,
      projectType,
      status,
      preSaleRatio,
      taxRate,
      externalLaborCost,
      externalSoftwareCost,
      otherCost,
      currentManpowerCost
    } = req.body

    // 确保项目名称是字符串类型并解码
    let processedProjectName = typeof projectName === 'string' ? projectName : '未命名项目'
    // 尝试解码项目名称
    try {
      processedProjectName = decodeURIComponent(processedProjectName)
      console.log('解码后的项目名称:', processedProjectName)
    } catch (error) {
      console.error('项目名称解码失败:', error)
    }
    console.log('接收到的项目名称:', projectName)
    console.log('处理后的项目名称:', processedProjectName)

    if (!projectCode) {
      return sendError(res, 400, '项目编号不能为空')
    }

    // 检查项目是否存在
    const existingProject = await prisma.project.findFirst({
      where: { projectCode: String(projectCode), userId }
    })

    let project
    if (existingProject) {
      // 更新现有项目
      project = await prisma.project.update({
        where: { id: existingProject.id },
        data: {
          projectName: processedProjectName || existingProject.projectName,
          projectType: projectType || existingProject.projectType,
          status: status || existingProject.status,
          contractAmount: contractAmount !== undefined ? contractAmount : existingProject.contractAmount,
          preSaleRatio: preSaleRatio !== undefined ? preSaleRatio : existingProject.preSaleRatio,
          taxRate: taxRate !== undefined ? taxRate : existingProject.taxRate,
          externalLaborCost: externalLaborCost !== undefined ? externalLaborCost : existingProject.externalLaborCost,
          externalSoftwareCost: externalSoftwareCost !== undefined ? externalSoftwareCost : existingProject.externalSoftwareCost,
          otherCost: otherCost !== undefined ? otherCost : existingProject.otherCost,
          currentManpowerCost: currentManpowerCost !== undefined ? currentManpowerCost : existingProject.currentManpowerCost
        }
      })
    } else {
      // 创建新项目
      project = await prisma.project.create({
        data: {
          userId,
          projectCode: String(projectCode),
          projectName: processedProjectName,
          projectType: projectType || 'software',
          status: status || 'ongoing',
          contractAmount: contractAmount || 0,
          preSaleRatio: preSaleRatio || 0,
          taxRate: taxRate || 0.06,
          externalLaborCost: externalLaborCost || 0,
          externalSoftwareCost: externalSoftwareCost || 0,
          otherCost: otherCost || 0,
          currentManpowerCost: currentManpowerCost || 0
        }
      })
    }

    // 同步更新或创建成本记录
    const existingCost = await prisma.projectCost.findFirst({
      where: { projectId: project.id }
    })

    const costData = {
      contractAmount: contractAmount || 0,
      preSaleRatio: preSaleRatio || 0,
      taxRate: taxRate || 0.06,
      externalLaborCost: externalLaborCost || 0,
      externalSoftwareCost: externalSoftwareCost || 0,
      otherCost: otherCost || 0,
      currentManpowerCost: currentManpowerCost || 0
    }

    if (existingCost) {
      await prisma.projectCost.update({
        where: { id: existingCost.id },
        data: costData
      })
    } else {
      await prisma.projectCost.create({
        data: {
          projectId: project.id,
          ...costData
        }
      })
    }

    sendResponse(res, {
      projectId: project.id,
      projectCode: project.projectCode,
      projectName: project.projectName
    }, '项目信息保存成功')
  } catch (error) {
    console.error('Save project error:', error)
    console.error('Error details:', JSON.stringify(error, null, 2))
    sendError(res, 500, '项目信息保存失败')
  }
})

/**
 * POST /:projectId/save-members - 保存项目人员信息
 */
router.post('/:projectId/save-members', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const { projectId } = req.params
    const userId = authReq.userId
    const { members } = req.body

    if (!await verifyProjectOwnership(Number(projectId), userId)) {
      return sendError(res, 403, '无权访问该项目')
    }

    if (!members || !Array.isArray(members)) {
      return sendError(res, 400, '请提供成员信息')
    }

    // 删除现有成员
    await prisma.projectMember.deleteMany({
      where: { projectId: Number(projectId) }
    })

    // 创建新成员
    for (const member of members) {
      // 处理"至结项"情况
      let leaveTime = member.leaveTime ? new Date(member.leaveTime) : null
      if (member.isToEnd) {
        leaveTime = new Date('2099-12-31')
      }

      await prisma.projectMember.create({
        data: {
          projectId: Number(projectId),
          name: member.name,
          department: member.department || null,
          level: member.level,
          dailyCost: member.dailyCost,
          role: member.role || null,
          entryTime: member.entryTime ? new Date(member.entryTime) : null,
          leaveTime: leaveTime,
          isToEnd: member.isToEnd || false,
          reportedHours: member.reportedHours || null
        }
      })
    }

    sendResponse(res, { projectId: Number(projectId), memberCount: members.length }, '人员信息保存成功')
  } catch (error) {
    console.error('Save members error:', error)
    sendError(res, 500, '人员信息保存失败')
  }
})

/**
 * POST /manual-create - 手动创建项目（不通过OCR）
 */
router.post('/manual-create', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const userId = authReq.userId
    const { projectName, projectCode, projectType } = req.body

    const project = await prisma.project.create({
      data: {
        userId,
        projectName: projectName || `手动创建项目_${dayjs().format('YYYYMMDD')}`,
        projectCode: projectCode || null,
        projectType: projectType || 'software',
        status: 'ongoing'
      }
    })

    sendResponse(res, {
      projectId: project.id,
      projectName: project.projectName,
      projectCode: project.projectCode,
      message: '项目创建成功，请继续录入成本信息'
    }, '项目创建成功')
  } catch (error) {
    console.error('Manual create error:', error)
    sendError(res, 500, '项目创建失败')
  }
})

/**
 * POST /ocr-preview - OCR识别预览（不保存数据，仅返回识别结果）
 */
router.post('/ocr-preview', authMiddleware, upload.array('files', 10), async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const userId = authReq.userId
    const files = req.files as Express.Multer.File[]

    if (!files || files.length === 0) {
      return sendError(res, 400, '请上传截图文件')
    }

    console.log(`[Consumption] 收到OCR预览请求，文件数: ${files.length}`)

    let mergedOcrResult = {
      contractAmount: 0,
      preSaleRatio: 0,
      taxRate: 0.06,
      externalLaborCost: 0,
      externalSoftwareCost: 0,
      currentManpowerCost: 0,
      members: [] as any[],
      rawText: ''
    }

    for (const file of files) {
      const filePath = path.join(uploadDir, file.filename)
      const ocrResult = await performOcrRecognition(filePath)

      mergedOcrResult.contractAmount = Math.max(mergedOcrResult.contractAmount, ocrResult.contractAmount || 0)
      mergedOcrResult.preSaleRatio = Math.max(mergedOcrResult.preSaleRatio, ocrResult.preSaleRatio || 0)
      mergedOcrResult.taxRate = Math.max(mergedOcrResult.taxRate, ocrResult.taxRate || 0)
      mergedOcrResult.externalLaborCost = Math.max(mergedOcrResult.externalLaborCost, ocrResult.externalLaborCost || 0)
      mergedOcrResult.externalSoftwareCost = Math.max(mergedOcrResult.externalSoftwareCost, ocrResult.externalSoftwareCost || 0)
      mergedOcrResult.currentManpowerCost = Math.max(mergedOcrResult.currentManpowerCost, ocrResult.currentManpowerCost || 0)
      mergedOcrResult.rawText += (ocrResult.rawText || '') + '\n'

      if (ocrResult.memberInfo && ocrResult.memberInfo.length > 0) {
        for (const member of ocrResult.memberInfo) {
          const existingMember = mergedOcrResult.members.find(m => m.name === member.name)
          if (!existingMember) {
            mergedOcrResult.members.push(member)
          }
        }
      }
    }

    console.log(`[Consumption] OCR预览识别结果: 合同金额=${mergedOcrResult.contractAmount}, 人力成本=${mergedOcrResult.currentManpowerCost}`)

    const response = {
      projectInfo: {
        projectName: '数字化项目',
        projectManager: '',
        startDate: dayjs().format('YYYY-MM-DD'),
        endDate: dayjs().add(1, 'year').format('YYYY-MM-DD'),
        status: '进行中'
      },
      memberInfo: mergedOcrResult.members.map(m => ({
        name: m.name || '',
        level: m.level || 'P5',
        role: m.role || '',
        reportedHours: m.reportedHours || 0
      })),
      costInfo: {
        contractAmount: mergedOcrResult.contractAmount,
        preSaleRatio: mergedOcrResult.preSaleRatio,
        taxRate: mergedOcrResult.taxRate,
        externalLaborCost: mergedOcrResult.externalLaborCost,
        externalSoftwareCost: mergedOcrResult.externalSoftwareCost,
        currentManpowerCost: mergedOcrResult.currentManpowerCost,
        otherCost: 0
      },
      message: 'OCR识别完成，请确认并编辑数据后保存'
    }

    sendResponse(res, response, 'OCR识别成功，请确认数据')
  } catch (error) {
    console.error('OCR preview error:', error)
    sendError(res, 500, 'OCR识别失败')
  }
})

/**
 * POST /ocr - OCR识别OA截图（真实调用 AI 服务）- 保留原有接口用于向后兼容
 */
router.post('/ocr', authMiddleware, upload.array('files', 10), async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const userId = authReq.userId
    const files = req.files as Express.Multer.File[]

    if (!files || files.length === 0) {
      return sendError(res, 400, '请上传截图文件')
    }

    console.log(`[Consumption] 收到OCR识别请求，文件数: ${files.length}`)

    const project = await prisma.project.create({
      data: {
        userId,
        projectName: `OCR识别项目_${dayjs().format('YYYYMMDD')}`,
        projectType: 'software',
        status: 'ongoing'
      }
    })

    let mergedOcrResult = {
      contractAmount: 0,
      preSaleRatio: 0,
      taxRate: 0.06,
      externalLaborCost: 0,
      externalSoftwareCost: 0,
      currentManpowerCost: 0,
      members: [] as any[],
      rawText: ''
    }

    for (const file of files) {
      const filePath = path.join(uploadDir, file.filename)
      const ocrResult = await performOcrRecognition(filePath)

      mergedOcrResult.contractAmount = Math.max(mergedOcrResult.contractAmount, ocrResult.contractAmount || 0)
      mergedOcrResult.preSaleRatio = Math.max(mergedOcrResult.preSaleRatio, ocrResult.preSaleRatio || 0)
      mergedOcrResult.taxRate = Math.max(mergedOcrResult.taxRate, ocrResult.taxRate || 0)
      mergedOcrResult.externalLaborCost = Math.max(mergedOcrResult.externalLaborCost, ocrResult.externalLaborCost || 0)
      mergedOcrResult.externalSoftwareCost = Math.max(mergedOcrResult.externalSoftwareCost, ocrResult.externalSoftwareCost || 0)
      mergedOcrResult.currentManpowerCost = Math.max(mergedOcrResult.currentManpowerCost, ocrResult.currentManpowerCost || 0)
      mergedOcrResult.rawText += (ocrResult.rawText || '') + '\n'

      if (ocrResult.memberInfo && ocrResult.memberInfo.length > 0) {
        for (const member of ocrResult.memberInfo) {
          const existingMember = mergedOcrResult.members.find(m => m.name === member.name)
          if (!existingMember) {
            mergedOcrResult.members.push(member)
          }
        }
      }
    }

    console.log(`[Consumption] OCR识别结果: 合同金额=${mergedOcrResult.contractAmount}, 人力成本=${mergedOcrResult.currentManpowerCost}`)

    if (mergedOcrResult.members.length > 0) {
      for (const member of mergedOcrResult.members) {
        const dailyCostMap = { P5: 0.08, P6: 0.1, P7: 0.15, P8: 0.2 }
        const dailyCost = dailyCostMap[member.level as keyof typeof dailyCostMap] || 0.1

        await prisma.projectMember.create({
          data: {
            projectId: project.id,
            name: member.name,
            level: member.level,
            dailyCost,
            role: member.role,
            reportedHours: member.reportedHours,
            entryTime: new Date()
          }
        })
      }
    }

    const response = {
      projectId: project.id,
      projectInfo: {
        projectName: project.projectName,
        projectManager: '',
        startDate: dayjs().format('YYYY-MM-DD'),
        endDate: dayjs().add(1, 'year').format('YYYY-MM-DD'),
        status: '进行中'
      },
      memberInfo: mergedOcrResult.members.map(m => ({
        name: m.name || '',
        level: m.level || 'P5',
        role: m.role || '',
        reportedHours: m.reportedHours || 0
      })),
      contractAmount: mergedOcrResult.contractAmount,
      preSaleRatio: mergedOcrResult.preSaleRatio,
      taxRate: mergedOcrResult.taxRate,
      externalLaborCost: mergedOcrResult.externalLaborCost,
      externalSoftwareCost: mergedOcrResult.externalSoftwareCost,
      currentManpowerCost: mergedOcrResult.currentManpowerCost,
      rawText: 'OCR识别完成'
    }

    sendResponse(res, response, 'OCR识别成功')
  } catch (error) {
    console.error('OCR error:', error)
    sendError(res, 500, 'OCR识别失败')
  }
})

/**
 * POST /:projectId/info - 保存项目信息
 */
router.post('/:projectId/info', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const { projectId } = req.params
    const userId = authReq.userId
    const data: SaveProjectInfoRequest = req.body

    if (!await verifyProjectOwnership(Number(projectId), userId)) {
      return sendError(res, 403, '无权访问该项目')
    }

    // 更新项目合同金额
    await prisma.project.update({
      where: { id: Number(projectId) },
      data: {
        contractAmount: data.contractAmount
      }
    })

    // 创建或更新成本记录
    const existingCost = await prisma.projectCost.findFirst({
      where: { projectId: Number(projectId) }
    })

    const costData = {
      contractAmount: data.contractAmount,
      preSaleRatio: data.preSaleRatio || 0,
      taxRate: data.taxRate || 0.06,
      externalLaborCost: data.externalLaborCost || 0,
      externalSoftwareCost: data.externalSoftwareCost || 0
    }

    if (existingCost) {
      await prisma.projectCost.update({
        where: { id: existingCost.id },
        data: costData
      })
    } else {
      await prisma.projectCost.create({
        data: {
          projectId: Number(projectId),
          ...costData
        }
      })
    }

    // 更新成员信息
    if (data.members && data.members.length > 0) {
      // 先删除现有成员
      await prisma.projectMember.deleteMany({
        where: { projectId: Number(projectId) }
      })

      // 创建新成员
      for (const member of data.members) {
        await prisma.projectMember.create({
          data: {
            projectId: Number(projectId),
            name: member.name,
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

    sendResponse(res, { projectId: Number(projectId) }, '项目信息保存成功')
  } catch (error) {
    console.error('Save project info error:', error)
    sendError(res, 500, '项目信息保存失败')
  }
})

/**
 * POST /:projectId/calculate - 计算成本
 */
router.post('/:projectId/calculate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const { projectId } = req.params
    const userId = authReq.userId

    if (!await verifyProjectOwnership(Number(projectId), userId)) {
      return sendError(res, 403, '无权访问该项目')
    }

    // 获取成本配置 - 包含所有必要字段
    const projectCost = await prisma.projectCost.findFirst({
      where: { projectId: Number(projectId) },
      select: {
        id: true,
        contractAmount: true,
        preSaleRatio: true,
        taxRate: true,
        externalLaborCost: true,
        externalSoftwareCost: true,
        otherCost: true,
        currentManpowerCost: true,
      }
    })

    if (!projectCost) {
      return sendError(res, 400, '请先保存项目成本信息')
    }

    // 获取成员信息 - 包含所有必要字段
    const members = await prisma.projectMember.findMany({
      where: { projectId: Number(projectId) },
      select: {
        id: true,
        name: true,
        department: true,
        level: true,
        dailyCost: true,
        role: true,
        entryTime: true,
        leaveTime: true,
        isToEnd: true,
        reportedHours: true,
      }
    })

    if (members.length === 0) {
      return sendError(res, 400, '请先添加项目成员')
    }

    // 计算各项成本
    const contractAmount = projectCost.contractAmount || 0
    const preSaleRatio = projectCost.preSaleRatio || 0
    const taxRate = projectCost.taxRate || 0.06
    const externalLaborCost = projectCost.externalLaborCost || 0
    const externalSoftwareCost = projectCost.externalSoftwareCost || 0
    const otherCost = projectCost.otherCost || 0

    // 售前成本
    const preSaleCost = contractAmount * preSaleRatio

    // 税金
    const taxCost = contractAmount * taxRate

    // 可用于项目实施的金额（新增 otherCost 减项）
    const implementationBudget = contractAmount - preSaleCost - taxCost - externalLaborCost - externalSoftwareCost - otherCost

    // 当前人力成本
    const currentManpowerCost = await calculateCurrentManpowerCost(Number(projectId))

    // 日人力成本
    const dailyManpowerCost = await calculateDailyManpowerCost(Number(projectId))

    // 可消耗成本
    const availableCost = implementationBudget - currentManpowerCost

    // 可消耗天数（保留整数）
    const availableDays = dailyManpowerCost > 0 ? Math.floor(availableCost / dailyManpowerCost) : 0

    // 燃尽日期
    const project = await prisma.project.findUnique({
      where: { id: Number(projectId) }
    })
    const startDate = project?.createdAt || new Date()
    const burnoutDate = calculateBurnoutDate(availableCost, dailyManpowerCost, startDate)

    // 更新成本记录
    await prisma.projectCost.update({
      where: { id: projectCost.id },
      data: {
        otherCost,
        currentManpowerCost,
        availableCost,
        dailyManpowerCost,
        availableDays,
        burnoutDate,
        calcTime: new Date()
      }
    })

    // 构建响应
    const memberCostDetails: MemberCostDetail[] = members.map(member => {
      const workingDays = member.reportedHours ? member.reportedHours / 8 : 0
      const totalCost = workingDays * member.dailyCost
      return {
        id: member.id,
        name: member.name,
        department: member.department,
        level: member.level,
        dailyCost: member.dailyCost,
        role: member.role,
        entryTime: member.entryTime?.toISOString() || null,
        leaveTime: member.leaveTime?.toISOString() || null,
        isToEnd: member.isToEnd,
        reportedHours: member.reportedHours,
        totalCost
      }
    })

    // 燃尽日期仅返回年月日格式
    const burnoutDateStr = burnoutDate ? dayjs(burnoutDate).format('YYYY-MM-DD') : null

    const response: ConsumptionResult = {
      contractAmount,
      preSaleRatio,
      taxRate,
      externalLaborCost,
      externalSoftwareCost,
      otherCost,
      currentManpowerCost,
      availableCost,
      dailyManpowerCost,
      availableDays,
      burnoutDate: burnoutDateStr,
      members: memberCostDetails
    }

    sendResponse(res, response, '成本计算成功')
  } catch (error) {
    console.error('Calculate cost error:', error)
    // 增强错误信息
    if (error instanceof Error) {
      console.error('Error stack:', error.stack)
      sendError(res, 500, `成本计算失败: ${error.message}`)
    } else {
      sendError(res, 500, '成本计算失败，请稍后重试')
    }
  }
})

/**
 * POST /:projectId/members - 调整项目成员
 */
router.post('/:projectId/members', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const { projectId } = req.params
    const userId = authReq.userId
    const data: AdjustMembersRequest = req.body

    if (!await verifyProjectOwnership(Number(projectId), userId)) {
      return sendError(res, 403, '无权访问该项目')
    }

    if (!data.members || data.members.length === 0) {
      return sendError(res, 400, '请提供成员信息')
    }

    // 删除现有成员
    await prisma.projectMember.deleteMany({
      where: { projectId: Number(projectId) }
    })

    // 创建新成员
    for (const member of data.members) {
      await prisma.projectMember.create({
        data: {
          projectId: Number(projectId),
          name: member.name,
          level: member.level,
          dailyCost: member.dailyCost,
          role: member.role,
          entryTime: member.entryTime ? new Date(member.entryTime) : null,
          leaveTime: member.leaveTime ? new Date(member.leaveTime) : null,
          reportedHours: member.reportedHours
        }
      })
    }

    // 重新计算
    const dailyManpowerCost = data.members.reduce((sum, m) => sum + m.dailyCost, 0)
    const currentManpowerCost = data.members.reduce((sum, m) => {
      if (m.reportedHours) {
        return sum + (m.reportedHours / 8) * m.dailyCost
      }
      return sum
    }, 0)

    // 更新成本记录
    const projectCost = await prisma.projectCost.findFirst({
      where: { projectId: Number(projectId) }
    })

    if (projectCost) {
      const availableCost = projectCost.contractAmount - projectCost.preSaleRatio * projectCost.contractAmount - projectCost.taxRate * projectCost.contractAmount - projectCost.externalLaborCost - projectCost.externalSoftwareCost - currentManpowerCost
      const availableDays = dailyManpowerCost > 0 ? Math.floor(availableCost / dailyManpowerCost) : 0

      const project = await prisma.project.findUnique({
        where: { id: Number(projectId) }
      })
      const startDate = project?.createdAt || new Date()
      const burnoutDate = calculateBurnoutDate(availableCost, dailyManpowerCost, startDate)

      await prisma.projectCost.update({
        where: { id: projectCost.id },
        data: {
          currentManpowerCost,
          dailyManpowerCost,
          availableCost,
          availableDays,
          burnoutDate,
          calcTime: new Date()
        }
      })
    }

    const members = await prisma.projectMember.findMany({
      where: { projectId: Number(projectId) }
    })

    const memberCostDetails: MemberCostDetail[] = members.map(member => {
      const workingDays = member.reportedHours ? member.reportedHours / 8 : 0
      const totalCost = workingDays * member.dailyCost
      return {
        id: member.id,
        name: member.name,
        department: member.department,
        level: member.level,
        dailyCost: member.dailyCost,
        role: member.role,
        entryTime: member.entryTime?.toISOString() || null,
        leaveTime: member.leaveTime?.toISOString() || null,
        isToEnd: member.isToEnd,
        reportedHours: member.reportedHours,
        totalCost
      }
    })

    sendResponse(res, memberCostDetails, '成员调整成功')
  } catch (error) {
    console.error('Adjust members error:', error)
    sendError(res, 500, '成员调整失败')
  }
})

/**
 * GET /:projectId/result - 获取核算结果
 */
router.get('/:projectId/result', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const { projectId } = req.params
    const userId = authReq.userId

    if (!await verifyProjectOwnership(Number(projectId), userId)) {
      return sendError(res, 403, '无权访问该项目')
    }

    // 获取项目基本信息
    const project = await prisma.project.findUnique({
      where: { id: Number(projectId) }
    })

    if (!project) {
      return sendError(res, 404, '项目不存在')
    }

    const projectCost = await prisma.projectCost.findFirst({
      where: { projectId: Number(projectId) }
    })

    if (!projectCost) {
      return sendError(res, 404, '未找到成本核算结果')
    }

    const members = await prisma.projectMember.findMany({
      where: { projectId: Number(projectId) }
    })

    const memberCostDetails: MemberCostDetail[] = members.map(member => {
      const workingDays = member.reportedHours ? member.reportedHours / 8 : 0
      const totalCost = workingDays * member.dailyCost
      return {
        id: member.id,
        name: member.name,
        department: member.department,
        level: member.level,
        dailyCost: member.dailyCost,
        role: member.role,
        entryTime: member.entryTime?.toISOString() || null,
        leaveTime: member.leaveTime?.toISOString() || null,
        isToEnd: member.isToEnd,
        reportedHours: member.reportedHours,
        totalCost
      }
    })

    const response: ConsumptionResult = {
      projectId: Number(projectId),
      projectCode: project.projectCode,
      projectName: project.projectName,
      projectType: project.projectType,
      status: project.status,
      contractAmount: projectCost.contractAmount,
      preSaleRatio: projectCost.preSaleRatio,
      taxRate: projectCost.taxRate,
      externalLaborCost: projectCost.externalLaborCost,
      externalSoftwareCost: projectCost.externalSoftwareCost,
      otherCost: projectCost.otherCost || 0,
      currentManpowerCost: projectCost.currentManpowerCost,
      availableCost: projectCost.availableCost,
      dailyManpowerCost: projectCost.dailyManpowerCost,
      availableDays: projectCost.availableDays,
      burnoutDate: projectCost.burnoutDate ? dayjs(projectCost.burnoutDate).format('YYYY-MM-DD') : null,
      members: memberCostDetails
    }

    sendResponse(res, response, '获取核算结果成功')
  } catch (error) {
    console.error('Get result error:', error)
    sendError(res, 500, '获取核算结果失败')
  }
})

/**
 * POST /:projectId/members/add - 添加单个成员
 */
router.post('/:projectId/members/add', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const { projectId } = req.params
    const userId = authReq.userId
    const memberData = req.body

    if (!await verifyProjectOwnership(Number(projectId), userId)) {
      return sendError(res, 403, '无权访问该项目')
    }

    if (!memberData.name || !memberData.level) {
      return sendError(res, 400, '成员姓名和职级不能为空')
    }

    const dailyCostMap = { P5: 0.08, P6: 0.1, P7: 0.15, P8: 0.2 }
    const dailyCost = memberData.dailyCost || dailyCostMap[memberData.level as keyof typeof dailyCostMap] || 0.1

    const member = await prisma.projectMember.create({
      data: {
        projectId: Number(projectId),
        name: memberData.name,
        department: memberData.department || null,
        level: memberData.level,
        dailyCost,
        role: memberData.role || null,
        entryTime: memberData.entryTime ? new Date(memberData.entryTime) : null,
        leaveTime: memberData.leaveTime ? new Date(memberData.leaveTime) : null,
        isToEnd: memberData.isToEnd || false,
        reportedHours: memberData.reportedHours || null
      }
    })

    sendResponse(res, {
      memberId: member.id,
      ...member
    }, '成员添加成功')
  } catch (error) {
    console.error('Add member error:', error)
    sendError(res, 500, '成员添加失败')
  }
})

/**
 * PUT /:projectId/members/:memberId - 更新成员信息
 */
router.put('/:projectId/members/:memberId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const { projectId, memberId } = req.params
    const userId = authReq.userId
    const memberData = req.body

    if (!await verifyProjectOwnership(Number(projectId), userId)) {
      return sendError(res, 403, '无权访问该项目')
    }

    const existingMember = await prisma.projectMember.findFirst({
      where: {
        id: Number(memberId),
        projectId: Number(projectId)
      }
    })

    if (!existingMember) {
      return sendError(res, 404, '成员不存在')
    }

    const updateData: any = {}
    if (memberData.name) updateData.name = memberData.name
    if (memberData.department !== undefined) updateData.department = memberData.department
    if (memberData.level) updateData.level = memberData.level
    if (memberData.dailyCost !== undefined) updateData.dailyCost = memberData.dailyCost
    if (memberData.role !== undefined) updateData.role = memberData.role
    if (memberData.entryTime !== undefined) updateData.entryTime = memberData.entryTime ? new Date(memberData.entryTime) : null
    if (memberData.leaveTime !== undefined) updateData.leaveTime = memberData.leaveTime ? new Date(memberData.leaveTime) : null
    if (memberData.isToEnd !== undefined) updateData.isToEnd = memberData.isToEnd
    if (memberData.reportedHours !== undefined) updateData.reportedHours = memberData.reportedHours

    const updatedMember = await prisma.projectMember.update({
      where: { id: Number(memberId) },
      data: updateData
    })

    sendResponse(res, updatedMember, '成员更新成功')
  } catch (error) {
    console.error('Update member error:', error)
    sendError(res, 500, '成员更新失败')
  }
})

/**
 * DELETE /:projectId/members/:memberId - 删除成员
 */
router.delete('/:projectId/members/:memberId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const { projectId, memberId } = req.params
    const userId = authReq.userId

    if (!await verifyProjectOwnership(Number(projectId), userId)) {
      return sendError(res, 403, '无权访问该项目')
    }

    const existingMember = await prisma.projectMember.findFirst({
      where: {
        id: Number(memberId),
        projectId: Number(projectId)
      }
    })

    if (!existingMember) {
      return sendError(res, 404, '成员不存在')
    }

    await prisma.projectMember.delete({
      where: { id: Number(memberId) }
    })

    sendResponse(res, { memberId: Number(memberId) }, '成员删除成功')
  } catch (error) {
    console.error('Delete member error:', error)
    sendError(res, 500, '成员删除失败')
  }
})

/**
 * GET /:projectId/members - 获取项目成员列表
 */
router.get('/:projectId/members', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const { projectId } = req.params
    const userId = authReq.userId

    if (!await verifyProjectOwnership(Number(projectId), userId)) {
      return sendError(res, 403, '无权访问该项目')
    }

    const members = await prisma.projectMember.findMany({
      where: { projectId: Number(projectId) },
      orderBy: { createdAt: 'asc' }
    })

    sendResponse(res, members, '获取成员列表成功')
  } catch (error) {
    console.error('Get members error:', error)
    sendError(res, 500, '获取成员列表失败')
  }
})

/**
 * PUT /:projectId/cost-info - 更新成本信息
 */
router.put('/:projectId/cost-info', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const { projectId } = req.params
    const userId = authReq.userId
    const costData = req.body

    if (!await verifyProjectOwnership(Number(projectId), userId)) {
      return sendError(res, 403, '无权访问该项目')
    }

    const existingCost = await prisma.projectCost.findFirst({
      where: { projectId: Number(projectId) }
    })

    const updateData: any = {}
    if (costData.contractAmount !== undefined) updateData.contractAmount = costData.contractAmount
    if (costData.preSaleRatio !== undefined) updateData.preSaleRatio = costData.preSaleRatio
    if (costData.taxRate !== undefined) updateData.taxRate = costData.taxRate
    if (costData.externalLaborCost !== undefined) updateData.externalLaborCost = costData.externalLaborCost
    if (costData.externalSoftwareCost !== undefined) updateData.externalSoftwareCost = costData.externalSoftwareCost
    if (costData.otherCost !== undefined) updateData.otherCost = costData.otherCost

    if (existingCost) {
      await prisma.projectCost.update({
        where: { id: existingCost.id },
        data: updateData
      })
    } else {
      await prisma.projectCost.create({
        data: {
          projectId: Number(projectId),
          contractAmount: costData.contractAmount || 0,
          preSaleRatio: costData.preSaleRatio || 0,
          taxRate: costData.taxRate || 0.06,
          externalLaborCost: costData.externalLaborCost || 0,
          externalSoftwareCost: costData.externalSoftwareCost || 0,
          otherCost: costData.otherCost || 0
        }
      })
    }

    sendResponse(res, { projectId: Number(projectId) }, '成本信息更新成功')
  } catch (error) {
    console.error('Update cost info error:', error)
    sendError(res, 500, '成本信息更新失败')
  }
})

/**
 * GET /:projectId/cost-info - 获取成本信息
 */
router.get('/:projectId/cost-info', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const { projectId } = req.params
    const userId = authReq.userId

    if (!await verifyProjectOwnership(Number(projectId), userId)) {
      return sendError(res, 403, '无权访问该项目')
    }

    const projectCost = await prisma.projectCost.findFirst({
      where: { projectId: Number(projectId) }
    })

    if (!projectCost) {
      return sendResponse(res, {
        contractAmount: 0,
        preSaleRatio: 0,
        taxRate: 0.06,
        externalLaborCost: 0,
        externalSoftwareCost: 0,
        otherCost: 0,
        currentManpowerCost: 0,
        availableCost: 0,
        dailyManpowerCost: 0,
        availableDays: 0,
        burnoutDate: null
      }, '暂无成本信息')
    }

    const response = {
      contractAmount: projectCost.contractAmount,
      preSaleRatio: projectCost.preSaleRatio,
      taxRate: projectCost.taxRate,
      externalLaborCost: projectCost.externalLaborCost,
      externalSoftwareCost: projectCost.externalSoftwareCost,
      otherCost: projectCost.otherCost || 0,
      currentManpowerCost: projectCost.currentManpowerCost || 0,
      availableCost: projectCost.availableCost || 0,
      dailyManpowerCost: projectCost.dailyManpowerCost || 0,
      availableDays: projectCost.availableDays || 0,
      burnoutDate: projectCost.burnoutDate ? dayjs(projectCost.burnoutDate).format('YYYY-MM-DD') : null
    }

    sendResponse(res, response, '获取成本信息成功')
  } catch (error) {
    console.error('Get cost info error:', error)
    sendError(res, 500, '获取成本信息失败')
  }
})

/**
 * POST /:projectId/confirm - 确认并计算最终成本
 */
router.post('/:projectId/confirm', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const { projectId } = req.params
    const userId = authReq.userId

    if (!await verifyProjectOwnership(Number(projectId), userId)) {
      return sendError(res, 403, '无权访问该项目')
    }

    const projectCost = await prisma.projectCost.findFirst({
      where: { projectId: Number(projectId) }
    })

    if (!projectCost) {
      return sendError(res, 400, '请先保存项目成本信息')
    }

    const members = await prisma.projectMember.findMany({
      where: { projectId: Number(projectId) }
    })

    if (members.length === 0) {
      return sendError(res, 400, '请先添加项目成员')
    }

    const contractAmount = projectCost.contractAmount || 0
    const preSaleRatio = projectCost.preSaleRatio || 0
    const taxRate = projectCost.taxRate || 0.06
    const externalLaborCost = projectCost.externalLaborCost || 0
    const externalSoftwareCost = projectCost.externalSoftwareCost || 0
    const otherCost = projectCost.otherCost || 0

    const preSaleCost = contractAmount * preSaleRatio
    const taxCost = contractAmount * taxRate
    const implementationBudget = contractAmount - preSaleCost - taxCost - externalLaborCost - externalSoftwareCost - otherCost

    const currentManpowerCost = await calculateCurrentManpowerCost(Number(projectId))
    const dailyManpowerCost = await calculateDailyManpowerCost(Number(projectId))
    const availableCost = implementationBudget - currentManpowerCost
    const availableDays = dailyManpowerCost > 0 ? Math.floor(availableCost / dailyManpowerCost) : 0

    const project = await prisma.project.findUnique({
      where: { id: Number(projectId) }
    })
    const startDate = project?.createdAt || new Date()
    const burnoutDate = calculateBurnoutDate(availableCost, dailyManpowerCost, startDate)

    await prisma.projectCost.update({
      where: { id: projectCost.id },
      data: {
        currentManpowerCost,
        availableCost,
        dailyManpowerCost,
        availableDays,
        burnoutDate,
        calcTime: new Date()
      }
    })

    const memberCostDetails: MemberCostDetail[] = members.map(member => {
      const workingDays = member.reportedHours ? member.reportedHours / 8 : 0
      const totalCost = workingDays * member.dailyCost
      return {
        id: member.id,
        name: member.name,
        department: member.department,
        level: member.level,
        dailyCost: member.dailyCost,
        role: member.role,
        entryTime: member.entryTime?.toISOString() || null,
        leaveTime: member.leaveTime?.toISOString() || null,
        isToEnd: member.isToEnd,
        reportedHours: member.reportedHours,
        totalCost
      }
    })

    const burnoutDateStr = burnoutDate ? dayjs(burnoutDate).format('YYYY-MM-DD') : null

    const response: ConsumptionResult = {
      contractAmount,
      preSaleRatio,
      taxRate,
      externalLaborCost,
      externalSoftwareCost,
      otherCost,
      currentManpowerCost,
      availableCost,
      dailyManpowerCost,
      availableDays,
      burnoutDate: burnoutDateStr,
      members: memberCostDetails
    }

    sendResponse(res, response, '成本确认计算成功')
  } catch (error) {
    console.error('Confirm cost error:', error)
    if (error instanceof Error) {
      console.error('Error stack:', error.stack)
      sendError(res, 500, `成本确认计算失败: ${error.message}`)
    } else {
      sendError(res, 500, '成本确认计算失败，请稍后重试')
    }
  }
})

export default router