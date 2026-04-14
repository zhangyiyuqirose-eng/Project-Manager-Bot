import winston from 'winston'
import path from 'path'
import fs from 'fs'

// 日志目录
const logDir = path.join(process.cwd(), 'logs')

// 确保日志目录存在
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true })
}

// 日志级别
const logLevel = process.env.LOG_LEVEL || 'info'

// 自定义日志格式
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...metadata }) => {
    let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`

    // 添加元数据
    if (Object.keys(metadata).length > 0) {
      logMessage += ` | ${JSON.stringify(metadata)}`
    }

    // 添加错误堆栈
    if (stack) {
      logMessage += `\n${stack}`
    }

    return logMessage
  })
)

// JSON 格式（用于生产环境）
const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
)

// 创建 logger 实例
export const logger = winston.createLogger({
  level: logLevel,
  defaultMeta: { service: 'cost-management-api' },
  transports: [
    // 错误日志单独文件
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: jsonFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    // 所有日志
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: jsonFormat,
      maxsize: 50 * 1024 * 1024, // 50MB
      maxFiles: 10,
    }),
  ],
})

// 开发环境添加控制台输出
if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        customFormat
      ),
    })
  )
}

// 便捷方法
export const logInfo = (message: string, meta?: Record<string, unknown>) =>
  logger.info(message, meta)

export const logError = (message: string, error?: Error, meta?: Record<string, unknown>) =>
  logger.error(message, { error: error?.message, stack: error?.stack, ...meta })

export const logWarn = (message: string, meta?: Record<string, unknown>) =>
  logger.warn(message, meta)

export const logDebug = (message: string, meta?: Record<string, unknown>) =>
  logger.debug(message, meta)

// HTTP 请求日志中间件
export const logRequest = (
  method: string,
  path: string,
  userId?: number,
  duration?: number,
  statusCode?: number
) => {
  const meta: Record<string, unknown> = {
    method,
    path,
    userId,
    duration,
    statusCode,
  }
  logInfo('HTTP Request', meta)
}

// API 操作日志
export const logOperation = (
  operation: string,
  projectId?: number,
  userId?: number,
  details?: Record<string, unknown>
) => {
  logInfo(`Operation: ${operation}`, {
    projectId,
    userId,
    ...details,
  })
}

export default logger