import { Response } from 'express'

/**
 * 统一 API 响应接口
 */
export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T | null
  meta?: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}

/**
 * 成功响应（使用 code: 200）
 * 兼容现有路由文件的行为
 * @param res Express Response 对象
 * @param data 响应数据
 * @param message 响应消息
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  message: string = '操作成功'
): void {
  res.json({
    code: 200,
    message,
    data
  })
}

/**
 * 成功响应（使用 code: 0）
 * 标准化响应格式
 * @param res Express Response 对象
 * @param data 响应数据
 * @param message 响应消息
 */
export function sendSuccessStandard<T>(
  res: Response,
  data: T,
  message: string = '操作成功'
): void {
  res.json({
    code: 0,
    message,
    data
  })
}

/**
 * 错误响应
 * @param res Express Response 对象
 * @param statusCode HTTP 状态码
 * @param message 错误消息
 */
export function sendError(
  res: Response,
  statusCode: number,
  message: string
): void {
  res.status(statusCode).json({
    code: statusCode,
    message,
    data: null
  })
}

/**
 * 分页响应
 * @param res Express Response 对象
 * @param items 数据项列表
 * @param total 总数量
 * @param page 当前页
 * @param pageSize 每页大小
 * @param message 响应消息
 */
export function sendPaginated<T>(
  res: Response,
  items: T[],
  total: number,
  page: number,
  pageSize: number,
  message: string = '查询成功'
): void {
  res.json({
    code: 0,
    message,
    data: { items },
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    }
  })
}

/**
 * 参数验证错误响应
 * @param res Express Response 对象
 * @param message 错误消息
 */
export function sendValidationError(
  res: Response,
  message: string
): void {
  sendError(res, 400, message)
}

/**
 * 未找到资源响应
 * @param res Express Response 对象
 * @param message 错误消息
 */
export function sendNotFound(
  res: Response,
  message: string = '资源不存在'
): void {
  sendError(res, 404, message)
}

/**
 * 服务器错误响应
 * @param res Express Response 对象
 * @param message 错误消息
 */
export function sendServerError(
  res: Response,
  message: string = '服务器内部错误'
): void {
  sendError(res, 500, message)
}