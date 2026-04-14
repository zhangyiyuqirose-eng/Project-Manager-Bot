import { Request, Response, NextFunction } from 'express'

/**
 * 简易 Rate Limiter（基于内存）
 *
 * 注意：生产环境建议使用 express-rate-limit + Redis 存储
 * 当前实现仅适用于单实例部署场景
 */

interface RateLimitEntry {
  count: number
  firstRequestTime: number
  blockedUntil: number
}

interface RateLimitOptions {
  windowMs: number  // 时间窗口（毫秒）
  max: number       // 最大请求次数
  message?: string  // 自定义错误消息
  keyGenerator?: (req: Request) => string  // 自定义 key 生成器
}

// 存储请求记录（内存）
const rateLimitStore = new Map<string, RateLimitEntry>()

// 清理过期记录（每分钟执行一次）
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.blockedUntil && now - entry.firstRequestTime > 60000) {
      rateLimitStore.delete(key)
    }
  }
}, 60000)

/**
 * 创建 Rate Limit 中间件
 */
export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    message = '请求过于频繁，请稍后再试',
    keyGenerator = (req: Request) => req.ip || 'unknown'
  } = options

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req)
    const now = Date.now()

    const entry = rateLimitStore.get(key)

    // 如果在封禁期内
    if (entry && now < entry.blockedUntil) {
      res.status(429).json({
        code: 429,
        message,
        data: null
      })
      return
    }

    // 如果没有记录或窗口过期，重置计数
    if (!entry || now - entry.firstRequestTime > windowMs) {
      rateLimitStore.set(key, {
        count: 1,
        firstRequestTime: now,
        blockedUntil: 0
      })
      next()
      return
    }

    // 在窗口内，增加计数
    entry.count++

    // 如果超过限制，封禁一个窗口周期
    if (entry.count > max) {
      entry.blockedUntil = now + windowMs
      res.status(429).json({
        code: 429,
        message,
        data: null
      })
      return
    }

    next()
  }
}

// 预定义的 Rate Limiter

/**
 * 认证端点限流（防止暴力破解）
 * 15分钟内最多10次登录尝试
 */
export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 10,
  message: '登录尝试过多，请稍后再试',
})

/**
 * API 通用限流
 * 1分钟内最多100次请求
 */
export const apiLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1分钟
  max: 100,
  message: '请求过于频繁，请稍后再试',
})

/**
 * AI 端点限流（AI调用耗时较长）
 * 5分钟内最多20次AI调用
 */
export const aiLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5分钟
  max: 20,
  message: 'AI调用过于频繁，请稍后再试',
})

export default {
  createRateLimiter,
  authLimiter,
  apiLimiter,
  aiLimiter,
}