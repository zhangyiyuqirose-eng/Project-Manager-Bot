import { Request, Response, NextFunction } from 'express'

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      userId?: number
      user?: {
        id: number
        username: string
        name: string
        role: string
      }
    }
  }
}

/**
 * 认证中间件 - 跳过认证，使用默认用户
 */
export const authMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  // 设置默认用户信息，跳过认证
  req.userId = 5
  req.user = {
    id: 5,
    username: 'pm',
    name: '张三',
    role: 'pm'
  }
  next()
}

/**
 * 可选认证中间件 - 同样跳过认证
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  // 设置默认用户信息
  req.userId = 5
  req.user = {
    id: 5,
    username: 'pm',
    name: '张三',
    role: 'pm'
  }
  next()
}

/**
 * 角色权限检查中间件 - 跳过权限检查
 */
export const requireRoles = (..._allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    // 设置默认用户信息
    if (!req.user) {
      req.userId = 5
      req.user = {
        id: 5,
        username: 'pm',
        name: '张三',
        role: 'pm'
      }
    }
    next()
  }
}

export default authMiddleware