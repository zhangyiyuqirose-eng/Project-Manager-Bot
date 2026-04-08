import { Router, Request, Response } from 'express'
import prisma from '../config/database'
import { authMiddleware } from '../middlewares/auth'

const router = Router()

// ==================== 类型定义 ====================

type ProjectStatus = 'ongoing' | 'completed' | 'paused' | 'cancelled'

interface CreateProjectBody {
  projectName: string
  projectType?: string
  contractAmount?: number
  status?: ProjectStatus
}

interface UpdateProjectBody {
  projectName?: string
  projectType?: string
  contractAmount?: number
  status?: ProjectStatus
}

interface ApiResponse<T> {
  code: number
  message: string
  data: T | null
  meta?: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

// ==================== 路由实现 ====================

/**
 * 获取项目列表
 * GET /api/projects
 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({
        code: 401,
        message: '未认证',
        data: null
      })
    }

    // 安全解析分页参数
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1)
    const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit || req.query.pageSize), 10) || 10))
    const skip = (page - 1) * limit

    const where: any = { userId }

    if (req.query.status) {
      where.status = req.query.status
    }

    if (req.query.projectType) {
      where.projectType = req.query.projectType
    }

    if (req.query.keyword) {
      where.projectName = { contains: String(req.query.keyword) }
    }

    // 安全解析排序参数
    const validSortFields = ['id', 'userId', 'projectName', 'projectType', 'contractAmount', 'status', 'createdAt', 'updatedAt']
    const sortBy = validSortFields.includes(String(req.query.sortBy)) ? String(req.query.sortBy) : 'createdAt'
    const sortOrder = String(req.query.sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc'

    const total = await prisma.project.count({ where })

    const projects = await prisma.project.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        projectName: true,
        projectType: true,
        contractAmount: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        documents: { select: { id: true } },
        members: { select: { id: true, name: true, level: true, role: true } },
        estimateResults: { select: { totalManDay: true, totalCost: true } },
        costs: { select: { availableCost: true, availableDays: true } }
      }
    })

    const totalPages = Math.ceil(total / limit)

    return res.json({
      code: 0,
      message: '获取成功',
      data: projects.map((p: any) => ({
        ...p,
        documentCount: p.documents.length,
        memberCount: p.members.length,
        documents: undefined
      })),
      meta: { total, page, limit, totalPages }
    })
  } catch (error) {
    console.error('Get projects error:', error)
    return res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null
    })
  }
})

/**
 * 获取项目详情
 * GET /api/projects/:id
 */
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({
        code: 401,
        message: '未认证',
        data: null
      })
    }

    const projectId = parseInt(String(req.params.id), 10)
    if (isNaN(projectId)) {
      return res.status(400).json({
        code: 400,
        message: '项目ID无效',
        data: null
      })
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
      select: {
        id: true,
        projectName: true,
        projectType: true,
        contractAmount: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        documents: {
          select: { id: true, docName: true, docType: true, parseStatus: true, createdAt: true }
        },
        members: {
          select: { id: true, name: true, level: true, dailyCost: true, role: true, entryTime: true, leaveTime: true, reportedHours: true }
        },
        estimateConfigs: {
          select: { id: true, complexityConfig: true, managementCoefficient: true, createdAt: true }
        },
        estimateResults: {
          select: { id: true, totalManDay: true, totalCost: true, moduleCount: true, manMonth: true, stageDetail: true, teamDetail: true, createdAt: true }
        },
        costs: {
          select: { id: true, contractAmount: true, availableCost: true, dailyManpowerCost: true, availableDays: true, burnoutDate: true, updatedAt: true }
        },
        deviations: {
          select: { id: true, costDeviation: true, taskProgress: true, currentCostConsumption: true, aiSuggestion: true, updatedAt: true }
        }
      }
    })

    if (!project) {
      return res.status(404).json({
        code: 404,
        message: '项目不存在或无权访问',
        data: null
      })
    }

    return res.json({
      code: 0,
      message: '获取成功',
      data: project
    })
  } catch (error) {
    console.error('Get project detail error:', error)
    return res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null
    })
  }
})

/**
 * 创建项目
 * POST /api/projects
 */
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({
        code: 401,
        message: '未认证',
        data: null
      })
    }

    const body = req.body as CreateProjectBody

    if (!body.projectName || body.projectName.trim() === '') {
      return res.status(400).json({
        code: 400,
        message: '项目名称不能为空',
        data: null
      })
    }

    const project = await prisma.project.create({
      data: {
        userId,
        projectName: body.projectName.trim(),
        projectType: body.projectType || null,
        contractAmount: body.contractAmount || null,
        status: body.status || 'ongoing'
      },
      select: {
        id: true,
        projectName: true,
        projectType: true,
        contractAmount: true,
        status: true,
        createdAt: true
      }
    })

    await prisma.operationLog.create({
      data: {
        userId,
        operationType: 'create_project',
        operationContent: JSON.stringify({ projectId: project.id, projectName: project.projectName }),
        ipAddress: req.ip || null
      }
    })

    return res.json({
      code: 0,
      message: '创建成功',
      data: project
    })
  } catch (error) {
    console.error('Create project error:', error)
    return res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null
    })
  }
})

/**
 * 更新项目
 * PUT /api/projects/:id
 */
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({
        code: 401,
        message: '未认证',
        data: null
      })
    }

    const projectId = parseInt(String(req.params.id), 10)
    if (isNaN(projectId)) {
      return res.status(400).json({
        code: 400,
        message: '项目ID无效',
        data: null
      })
    }

    const body = req.body as UpdateProjectBody

    const existingProject = await prisma.project.findFirst({
      where: { id: projectId, userId }
    })

    if (!existingProject) {
      return res.status(404).json({
        code: 404,
        message: '项目不存在或无权访问',
        data: null
      })
    }

    const updateData: any = {}

    if (body.projectName && body.projectName.trim() !== '') {
      updateData.projectName = body.projectName.trim()
    }

    if (body.projectType !== undefined) {
      updateData.projectType = body.projectType || null
    }

    if (body.contractAmount !== undefined) {
      updateData.contractAmount = body.contractAmount || null
    }

    if (body.status !== undefined) {
      const validStatuses: ProjectStatus[] = ['ongoing', 'completed', 'paused', 'cancelled']
      if (!validStatuses.includes(body.status)) {
        return res.status(400).json({
          code: 400,
          message: '无效的项目状态',
          data: null
        })
      }
      updateData.status = body.status
    }

    const project = await prisma.project.update({
      where: { id: projectId },
      data: updateData,
      select: {
        id: true,
        projectName: true,
        projectType: true,
        contractAmount: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    })

    await prisma.operationLog.create({
      data: {
        userId,
        operationType: 'update_project',
        operationContent: JSON.stringify({ projectId: project.id, changes: updateData }),
        ipAddress: req.ip || null
      }
    })

    return res.json({
      code: 0,
      message: '更新成功',
      data: project
    })
  } catch (error) {
    console.error('Update project error:', error)
    return res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null
    })
  }
})

/**
 * 删除项目
 * DELETE /api/projects/:id
 */
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({
        code: 401,
        message: '未认证',
        data: null
      })
    }

    const projectId = parseInt(String(req.params.id), 10)
    if (isNaN(projectId)) {
      return res.status(400).json({
        code: 400,
        message: '项目ID无效',
        data: null
      })
    }

    const existingProject = await prisma.project.findFirst({
      where: { id: projectId, userId }
    })

    if (!existingProject) {
      return res.status(404).json({
        code: 404,
        message: '项目不存在或无权访问',
        data: null
      })
    }

    await prisma.project.delete({ where: { id: projectId } })

    await prisma.operationLog.create({
      data: {
        userId,
        operationType: 'delete_project',
        operationContent: JSON.stringify({ projectId, projectName: existingProject.projectName }),
        ipAddress: req.ip || null
      }
    })

    return res.json({
      code: 0,
      message: '删除成功',
      data: null
    })
  } catch (error) {
    console.error('Delete project error:', error)
    return res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null
    })
  }
})

export default router