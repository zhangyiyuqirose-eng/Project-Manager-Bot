import { Router, Request, Response } from 'express'
import prisma from '../config/database'
import { authMiddleware } from '../middlewares/auth'

const router = Router()

interface ApiResponse<T> {
  code: number
  message: string
  data: T | null
}

const RISK_THRESHOLDS = {
  highRisk: 30,
  mediumRisk: 15,
  lowRisk: 5,
  burnoutWarning: 30
}

/**
 * 获取首页统计数据
 * GET /api/dashboard/stats
 */
router.get('/stats', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({
        code: 401,
        message: '未认证',
        data: null
      })
    }

    const projects = await prisma.project.findMany({
      where: { userId },
      select: {
        id: true,
        projectName: true,
        status: true,
        contractAmount: true,
        updatedAt: true,
        costs: {
          select: {
            availableCost: true,
            availableDays: true,
            currentManpowerCost: true,
            burnoutDate: true
          }
        },
        deviations: {
          select: {
            costDeviation: true,
            taskProgress: true,
            currentCostConsumption: true
          }
        },
        estimateResults: {
          select: {
            totalCost: true,
            totalManDay: true
          }
        },
        members: {
          select: {
            dailyCost: true
          }
        }
      }
    })

    const totalProjects = projects.length
    const ongoingProjects = projects.filter((p: any) => p.status === 'ongoing').length
    const completedProjects = projects.filter((p: any) => p.status === 'completed').length
    const pausedProjects = projects.filter((p: any) => p.status === 'paused').length
    const cancelledProjects = projects.filter((p: any) => p.status === 'cancelled').length

    const totalContractAmount = projects.reduce((sum: number, p: any) => sum + (p.contractAmount || 0), 0)
    const totalEstimatedCost = projects.reduce((sum: number, p: any) => sum + (p.estimateResults[0]?.totalCost || 0), 0)
    const totalActualCost = projects.reduce((sum: number, p: any) => sum + (p.deviations[0]?.currentCostConsumption || 0), 0)

    const costAbnormalCount = projects.filter((p: any) => {
      const deviation = p.deviations[0]
      if (!deviation) return false
      return Math.abs(deviation.costDeviation) > RISK_THRESHOLDS.mediumRisk
    }).length

    let highRiskCount = 0
    let mediumRiskCount = 0
    let lowRiskCount = 0

    projects.forEach((p: any) => {
      const deviation = p.deviations[0]
      const cost = p.costs[0]

      if (deviation) {
        const absDeviation = Math.abs(deviation.costDeviation)
        if (absDeviation > RISK_THRESHOLDS.highRisk) {
          highRiskCount++
        } else if (absDeviation > RISK_THRESHOLDS.mediumRisk) {
          mediumRiskCount++
        } else if (absDeviation > RISK_THRESHOLDS.lowRisk) {
          lowRiskCount++
        }
      }

      if (cost && cost.availableDays && cost.availableDays < RISK_THRESHOLDS.burnoutWarning) {
        if (cost.availableDays < 7) {
          highRiskCount++
        } else if (cost.availableDays < 15) {
          mediumRiskCount++
        } else {
          lowRiskCount++
        }
      }
    })

    const memberStats = await prisma.projectMember.aggregate({
      where: { project: { userId } },
      _count: { id: true },
      _avg: { dailyCost: true }
    })

    const totalMembers = memberStats._count.id || 0
    const avgDailyCost = memberStats._avg.dailyCost || 0

    const recentProjects = projects
      .sort((a: any, b: any) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 5)
      .map((p: any) => ({
        id: p.id,
        projectName: p.projectName,
        status: p.status,
        updatedAt: p.updatedAt
      }))

    return res.json({
      code: 0,
      message: '获取成功',
      data: {
        totalProjects,
        ongoingProjects,
        completedProjects,
        pausedProjects,
        cancelledProjects,
        totalContractAmount,
        totalEstimatedCost,
        totalActualCost,
        costAbnormalCount,
        highRiskCount,
        mediumRiskCount,
        lowRiskCount,
        totalMembers,
        avgDailyCost,
        recentProjects
      }
    })
  } catch (error) {
    console.error('Get dashboard stats error:', error)
    return res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null
    })
  }
})

/**
 * 获取成本趋势数据
 * GET /api/dashboard/cost-trend
 */
router.get('/cost-trend', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({
        code: 401,
        message: '未认证',
        data: null
      })
    }

    const deviations = await prisma.costDeviation.findMany({
      where: { project: { userId } },
      select: {
        costDeviation: true,
        taskProgress: true,
        currentCostConsumption: true,
        updatedAt: true,
        project: { select: { projectName: true } }
      },
      orderBy: { updatedAt: 'desc' },
      take: 50
    })

    const trendData = deviations.map((d: any) => ({
      date: d.updatedAt.toISOString().split('T')[0],
      projectName: d.project.projectName,
      costDeviation: d.costDeviation,
      taskProgress: d.taskProgress,
      currentCostConsumption: d.currentCostConsumption
    }))

    return res.json({
      code: 0,
      message: '获取成功',
      data: trendData
    })
  } catch (error) {
    console.error('Get cost trend error:', error)
    return res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null
    })
  }
})

/**
 * 获取风险预警列表
 * GET /api/dashboard/risk-alerts
 */
router.get('/risk-alerts', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({
        code: 401,
        message: '未认证',
        data: null
      })
    }

    const projects = await prisma.project.findMany({
      where: { userId },
      select: {
        id: true,
        projectName: true,
        status: true,
        deviations: {
          select: {
            costDeviation: true,
            taskProgress: true,
            currentCostConsumption: true,
            aiSuggestion: true,
            updatedAt: true
          }
        },
        costs: {
          select: {
            availableDays: true,
            availableCost: true,
            burnoutDate: true
          }
        }
      }
    })

    const alerts: any[] = []

    projects.forEach((project: any) => {
      const deviation = project.deviations[0]
      const cost = project.costs[0]

      if (deviation) {
        const absDeviation = Math.abs(deviation.costDeviation)
        if (absDeviation > RISK_THRESHOLDS.lowRisk) {
          let riskLevel: 'high' | 'medium' | 'low' = 'low'
          if (absDeviation > RISK_THRESHOLDS.highRisk) {
            riskLevel = 'high'
          } else if (absDeviation > RISK_THRESHOLDS.mediumRisk) {
            riskLevel = 'medium'
          }

          alerts.push({
            projectId: project.id,
            projectName: project.projectName,
            status: project.status,
            riskLevel,
            riskType: deviation.costDeviation > 0 ? 'cost_overrun' : 'cost_underuse',
            riskValue: deviation.costDeviation,
            suggestion: deviation.aiSuggestion,
            updatedAt: deviation.updatedAt
          })
        }
      }

      if (cost && cost.availableDays && cost.availableDays < RISK_THRESHOLDS.burnoutWarning) {
        let riskLevel: 'high' | 'medium' | 'low' = 'low'
        if (cost.availableDays < 7) {
          riskLevel = 'high'
        } else if (cost.availableDays < 15) {
          riskLevel = 'medium'
        }

        alerts.push({
          projectId: project.id,
          projectName: project.projectName,
          status: project.status,
          riskLevel,
          riskType: 'burnout_warning',
          riskValue: cost.availableDays,
          suggestion: `预计燃尽日期: ${cost.burnoutDate?.toISOString().split('T')[0] || '未知'}`,
          updatedAt: new Date()
        })
      }
    })

    alerts.sort((a: any, b: any) => {
      const levelOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
      return levelOrder[a.riskLevel] - levelOrder[b.riskLevel]
    })

    return res.json({
      code: 0,
      message: '获取成功',
      data: alerts
    })
  } catch (error) {
    console.error('Get risk alerts error:', error)
    return res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null
    })
  }
})

export default router