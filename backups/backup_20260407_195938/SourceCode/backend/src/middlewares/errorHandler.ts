/**
 * 错误处理中间件
 * 统一处理应用中的错误，返回标准化的错误响应
 */

import { Request, Response, NextFunction } from 'express'

/**
 * 自定义应用错误类
 */
export class AppError extends Error {
  public code: number
  public statusCode: number

  constructor(message: string, code: number = 500, statusCode: number = 500) {
    super(message)
    this.code = code
    this.statusCode = statusCode
    this.name = 'AppError'
  }
}

/**
 * 业务逻辑错误
 */
export class BusinessError extends AppError {
  constructor(message: string, code: number = 400) {
    super(message, code, 400)
    this.name = 'BusinessError'
  }
}

/**
 * 认证错误
 */
export class AuthError extends AppError {
  constructor(message: string, code: number = 401) {
    super(message, code, 401)
    this.name = 'AuthError'
  }
}

/**
 * 权限错误
 */
export class ForbiddenError extends AppError {
  constructor(message: string = '无权限访问') {
    super(message, 403, 403)
    this.name = 'ForbiddenError'
  }
}

/**
 * 资源未找到错误
 */
export class NotFoundError extends AppError {
  constructor(message: string = '资源不存在') {
    super(message, 404, 404)
    this.name = 'NotFoundError'
  }
}

/**
 * 验证错误
 */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 422, 422)
    this.name = 'ValidationError'
  }
}

/**
 * 错误响应接口
 */
interface ErrorResponse {
  code: number
  message: string
  details?: unknown
  stack?: string
}

/**
 * 全局错误处理中间件
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isDev = process.env.NODE_ENV === 'development'

  // 默认错误响应
  const response: ErrorResponse = {
    code: 500,
    message: '服务器内部错误'
  }

  // 根据错误类型处理
  if (err instanceof AppError) {
    response.code = err.code
    response.message = err.message
    res.status(err.statusCode)
  } else {
    // 未知错误
    res.status(500)
  }

  // 开发环境返回错误堆栈
  if (isDev) {
    response.stack = err.stack
    response.details = err
  }

  // 记录错误日志
  console.error(`[${new Date().toISOString()}] Error:`, {
    message: err.message,
    code: response.code,
    path: req.path,
    method: req.method,
    stack: isDev ? err.stack : undefined
  })

  res.json(response)
}

/**
 * 异步路由处理器包装函数
 * 自动捕获异步错误并传递给错误处理中间件
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}