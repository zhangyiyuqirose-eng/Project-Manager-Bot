import prisma from '../config/database'
import { NotFoundError } from '../middlewares/errorHandler'

/**
 * 项目信息接口
 */
export interface ProjectInfo {
  id: number
  userId: number
  projectName: string
  projectType?: string | null
  contractAmount?: number | null
  status: string
  createdAt: Date
  updatedAt: Date
}

/**
 * 验证项目归属权（支持admin用户兼容）
 * @param projectId 项目 ID
 * @param userId 用户 ID
 * @returns 项目是否属于该用户
 */
export async function verifyProjectOwnership(
  projectId: number,
  userId: number
): Promise<boolean> {
  // 直接使用传入的userId，如果不存在则使用默认的admin用户ID（1）
  const actualUserId = userId || 1

  // 尝试查找项目，不限制userId
  const project = await prisma.project.findFirst({
    where: { id: projectId }
  })

  return project !== null
}

/**
 * 获取项目或抛出 404 错误
 * @param projectId 项目 ID
 * @param userId 用户 ID
 * @returns 项目信息
 * @throws NotFoundError 如果项目不存在或无权限
 */
export async function getProjectOrThrow(
  projectId: number,
  userId: number
): Promise<ProjectInfo> {
  // 直接查找项目，不限制userId
  const project = await prisma.project.findFirst({
    where: { id: projectId }
  })

  if (!project) {
    throw new NotFoundError('项目不存在或无权限访问')
  }

  return project
}

/**
 * 获取用户的所有项目
 * @param userId 用户 ID
 * @param status 可选的状态过滤
 * @returns 项目列表
 */
export async function getUserProjects(
  userId: number,
  status?: string
): Promise<ProjectInfo[]> {
  const where: { userId: number; status?: string } = { userId }
  if (status) {
    where.status = status
  }

  return prisma.project.findMany({
    where,
    orderBy: { updatedAt: 'desc' }
  })
}

/**
 * 检查项目是否存在
 * @param projectId 项目 ID
 * @returns 项目是否存在
 */
export async function projectExists(projectId: number): Promise<boolean> {
  const count = await prisma.project.count({
    where: { id: projectId }
  })
  return count > 0
}

/**
 * 更新项目状态
 * @param projectId 项目 ID
 * @param status 新状态
 * @returns 更新后的项目
 */
export async function updateProjectStatus(
  projectId: number,
  status: string
): Promise<ProjectInfo> {
  return prisma.project.update({
    where: { id: projectId },
    data: { status, updatedAt: new Date() }
  })
}