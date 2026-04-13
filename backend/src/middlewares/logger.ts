/**
 * 请求日志中间件
 * 记录所有HTTP请求的详细信息
 */

import { Request, Response, NextFunction } from 'express'
import dayjs from 'dayjs'

/**
 * 请求日志接口
 */
interface RequestLog {
  timestamp: string
  method: string
  path: string
  query: Record<string, unknown>
  ip: string
  userAgent: string
  userId?: number
  username?: string
}

/**
 * 响应日志接口
 */
interface ResponseLog extends RequestLog {
  statusCode: number
  duration: number
}

/**
 * 格式化日志输出
 */
function formatLog(log: RequestLog | ResponseLog): string {
  const user = log.userId ? `[${log.username || log.userId}]` : '[匿名]'
  return `${log.timestamp} ${log.method} ${log.path} ${user} IP:${log.ip}`
}

/**
 * 请求日志中间件
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now()
  const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss')

  // 基础请求信息
  const requestLog: RequestLog = {
    timestamp,
    method: req.method,
    path: req.path,
    query: req.query as Record<string, unknown>,
    ip: req.ip || req.socket.remoteAddress || 'unknown',
    userAgent: req.get('user-agent') || 'unknown'
  }

  // 如果有用户信息，添加到日志
  if (req.user) {
    requestLog.userId = req.user.id
    requestLog.username = req.user.username
  }

  // 记录请求开始
  console.log(`--> ${formatLog(requestLog)}`)

  // 监听响应完成事件
  res.on('finish', () => {
    const duration = Date.now() - startTime
    const responseLog: ResponseLog = {
      ...requestLog,
      statusCode: res.statusCode,
      duration
    }

    // 根据状态码选择日志级别
    const status = res.statusCode
    const logPrefix = status >= 500 ? 'xxx' : status >= 400 ? 'err' : '<--'
    const logMessage = `${logPrefix} ${formatLog(responseLog)} ${status} ${duration}ms`

    if (status >= 500) {
      console.error(logMessage)
    } else if (status >= 400) {
      console.warn(logMessage)
    } else {
      console.log(logMessage)
    }
  })

  next()
}

/**
 * 操作日志类型枚举
 */
export const OperationType = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  VIEW: 'view',
  EXPORT: 'export',
  IMPORT: 'import'
} as const

/**
 * 创建操作日志记录器
 * 用于在业务逻辑中记录操作日志
 */
export function createOperationLogger(prisma: {
  operationLog: {
    create: (args: { data: unknown }) => Promise<unknown>
  }
}) {
  return async function logOperation(
    userId: number,
    operationType: string,
    operationContent?: string,
    ipAddress?: string
  ): Promise<void> {
    try {
      await prisma.operationLog.create({
        data: {
          userId,
          operationType,
          operationContent,
          ipAddress
        }
      })
    } catch (error) {
      console.error('记录操作日志失败:', error)
    }
  }
}