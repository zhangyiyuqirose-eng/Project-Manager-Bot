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
  OcrResult,
  SaveProjectInfoRequest,
  ProjectMemberInput,
  AdjustMembersRequest,
  ConsumptionResult,
  MemberCostDetail,
  AuthenticatedRequest
} from '../types'

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
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`
    cb(null, uniqueName)
  }
})

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp']
    const ext = path.extname(file.originalname).toLowerCase()
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
 * 模拟 OCR 识别（实际项目中应接入真实的 OCR 服务）
 */
const mockOcrRecognition = async (filePath: string): Promise<OcrResult> => {
  // 模拟识别结果 - 实际项目中应调用 OCR API
  return {
    projectInfo: {
      projectName: '数字化项目',
      projectManager: '张三',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      status: '进行中'
    },
    memberInfo: [
      { name: '张三', level: 'P7', role: '项目经理', reportedHours: 800 },
      { name: '李四', level: 'P6', role: '开发工程师', reportedHours: 600 },
      { name: '王五', level: 'P6', role: '开发工程师', reportedHours: 500 },
      { name: '赵六', level: 'P5', role: '测试工程师', reportedHours: 400 }
    ],
    rawText: '模拟的OCR识别文本内容...'
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
 * POST /ocr - OCR识别OA截图
 */
router.post('/ocr', authMiddleware, upload.single('image'), async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const userId = authReq.userId
    const file = req.file

    if (!file) {
      return sendError(res, 400, '请上传截图文件')
    }

    // 创建项目
    const project = await prisma.project.create({
      data: {
        userId,
        projectName: `OCR识别项目_${dayjs().format('YYYYMMDD')}`,
        projectType: 'software',
        status: 'ongoing'
      }
    })

    // OCR识别
    const filePath = path.join(uploadDir, file.filename)
    const ocrResult = await mockOcrRecognition(filePath)

    // 根据识别结果创建成员
    if (ocrResult.memberInfo && ocrResult.memberInfo.length > 0) {
      for (const member of ocrResult.memberInfo) {
        // 根据职级设置默认日成本
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
            entryTime: ocrResult.projectInfo.startDate ? new Date(ocrResult.projectInfo.startDate) : null
          }
        })
      }
    }

    const response: OcrResult = {
      ...ocrResult,
      projectInfo: {
        ...ocrResult.projectInfo,
        projectName: ocrResult.projectInfo.projectName || project.projectName
      }
    }

    sendResponse(res, { ...response, projectId: project.id }, 'OCR识别成功')
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

    // 获取成本配置
    const projectCost = await prisma.projectCost.findFirst({
      where: { projectId: Number(projectId) }
    })

    if (!projectCost) {
      return sendError(res, 400, '请先保存项目成本信息')
    }

    // 获取成员信息
    const members = await prisma.projectMember.findMany({
      where: { projectId: Number(projectId) }
    })

    if (members.length === 0) {
      return sendError(res, 400, '请先添加项目成员')
    }

    // 计算各项成本
    const contractAmount = projectCost.contractAmount
    const preSaleRatio = projectCost.preSaleRatio
    const taxRate = projectCost.taxRate
    const externalLaborCost = projectCost.externalLaborCost
    const externalSoftwareCost = projectCost.externalSoftwareCost

    // 售前成本
    const preSaleCost = contractAmount * preSaleRatio

    // 税金
    const taxCost = contractAmount * taxRate

    // 可用于项目实施的金额
    const implementationBudget = contractAmount - preSaleCost - taxCost - externalLaborCost - externalSoftwareCost

    // 当前人力成本
    const currentManpowerCost = await calculateCurrentManpowerCost(Number(projectId))

    // 日人力成本
    const dailyManpowerCost = await calculateDailyManpowerCost(Number(projectId))

    // 可消耗成本
    const availableCost = implementationBudget - currentManpowerCost

    // 可消耗天数
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
        level: member.level,
        dailyCost: member.dailyCost,
        role: member.role,
        entryTime: member.entryTime?.toISOString() || null,
        leaveTime: member.leaveTime?.toISOString() || null,
        reportedHours: member.reportedHours,
        totalCost
      }
    })

    const response: ConsumptionResult = {
      contractAmount,
      preSaleRatio,
      taxRate,
      externalLaborCost,
      externalSoftwareCost,
      currentManpowerCost,
      availableCost,
      dailyManpowerCost,
      availableDays,
      burnoutDate: burnoutDate?.toISOString() || null,
      members: memberCostDetails
    }

    sendResponse(res, response, '成本计算成功')
  } catch (error) {
    console.error('Calculate cost error:', error)
    sendError(res, 500, '成本计算失败')
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
        level: member.level,
        dailyCost: member.dailyCost,
        role: member.role,
        entryTime: member.entryTime?.toISOString() || null,
        leaveTime: member.leaveTime?.toISOString() || null,
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
        level: member.level,
        dailyCost: member.dailyCost,
        role: member.role,
        entryTime: member.entryTime?.toISOString() || null,
        leaveTime: member.leaveTime?.toISOString() || null,
        reportedHours: member.reportedHours,
        totalCost
      }
    })

    const response: ConsumptionResult = {
      contractAmount: projectCost.contractAmount,
      preSaleRatio: projectCost.preSaleRatio,
      taxRate: projectCost.taxRate,
      externalLaborCost: projectCost.externalLaborCost,
      externalSoftwareCost: projectCost.externalSoftwareCost,
      currentManpowerCost: projectCost.currentManpowerCost,
      availableCost: projectCost.availableCost,
      dailyManpowerCost: projectCost.dailyManpowerCost,
      availableDays: projectCost.availableDays,
      burnoutDate: projectCost.burnoutDate?.toISOString() || null,
      members: memberCostDetails
    }

    sendResponse(res, response, '获取核算结果成功')
  } catch (error) {
    console.error('Get result error:', error)
    sendError(res, 500, '获取核算结果失败')
  }
})

export default router