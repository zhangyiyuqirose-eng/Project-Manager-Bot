/**
 * 认证路由
 * 处理用户登录、登出、获取用户信息、修改密码等操作
 */

import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../config/database'
import { authMiddleware } from '../middlewares/auth'
import { BusinessError, AuthError, ValidationError, asyncHandler } from '../middlewares/errorHandler'

const router = Router()

/**
 * JWT配置
 */
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h'

/**
 * 登录锁定配置
 */
const MAX_LOGIN_ERRORS = 5  // 最大登录错误次数
const LOCK_DURATION_MINUTES = 30  // 锁定时长（分钟）

/**
 * 登录请求接口
 */
interface LoginRequest {
  username: string
  password: string
}

/**
 * 修改密码请求接口
 */
interface ChangePasswordRequest {
  oldPassword: string
  newPassword: string
}

/**
 * 用户信息响应接口
 */
interface UserInfoResponse {
  id: number
  username: string
  name: string
  email: string | null
  role: string
  status: string
  lastLoginTime: string | null
}

/**
 * POST /api/auth/login
 * 用户登录接口
 *
 * 功能：
 * 1. 验证用户名和密码
 * 2. 检查账户锁定状态
 * 3. 登录成功：生成JWT token，更新登录时间，重置错误计数，记录日志
 * 4. 登录失败：增加错误计数，达到上限时锁定账户
 */
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { username, password } = req.body as LoginRequest

  // 参数验证
  if (!username || !password) {
    throw new ValidationError('用户名和密码不能为空')
  }

  // 查询用户
  const user = await prisma.user.findUnique({
    where: { username }
  })

  if (!user) {
    throw new AuthError('用户名或密码错误')
  }

  // 检查账户状态
  if (user.status === 'disabled') {
    throw new AuthError('账户已被禁用，请联系管理员')
  }

  // 检查是否被锁定
  if (user.status === 'locked' && user.lockEndTime) {
    const lockEndTime = new Date(user.lockEndTime)
    if (lockEndTime > new Date()) {
      const remainingMinutes = Math.ceil((lockEndTime.getTime() - Date.now()) / 60000)
      throw new AuthError(`账户已被锁定，请在 ${remainingMinutes} 分钟后重试`)
    }
    // 锁定时间已过，解除锁定
    await prisma.user.update({
      where: { id: user.id },
      data: {
        status: 'active',
        loginErrorCount: 0,
        lockEndTime: null
      }
    })
  }

  // 验证密码
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash)
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown'

  if (!isPasswordValid) {
    // 登录失败，增加错误计数
    const newErrorCount = user.loginErrorCount + 1

    if (newErrorCount >= MAX_LOGIN_ERRORS) {
      // 达到上限，锁定账户
      const lockEndTime = new Date(Date.now() + LOCK_DURATION_MINUTES * 60000)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          status: 'locked',
          loginErrorCount: newErrorCount,
          lockEndTime
        }
      })

      // 记录锁定日志
      await prisma.operationLog.create({
        data: {
          userId: user.id,
          operationType: 'login_locked',
          operationContent: `登录失败次数达到上限，账户被锁定`,
          ipAddress: clientIp
        }
      })

      throw new AuthError(`登录失败次数过多，账户已被锁定 ${LOCK_DURATION_MINUTES} 分钟`)
    }

    // 更新错误计数
    await prisma.user.update({
      where: { id: user.id },
      data: { loginErrorCount: newErrorCount }
    })

    throw new AuthError(`用户名或密码错误，剩余尝试次数：${MAX_LOGIN_ERRORS - newErrorCount}`)
  }

  // 登录成功
  // 生成JWT Token
  const token = jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  )

  // 更新用户登录信息
  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginTime: new Date(),
      loginErrorCount: 0,
      lockEndTime: null,
      status: 'active'
    }
  })

  // 记录登录日志
  await prisma.operationLog.create({
    data: {
      userId: user.id,
      operationType: 'login',
      operationContent: '用户登录成功',
      ipAddress: clientIp
    }
  })

  // 返回响应
  res.json({
    code: 200,
    message: '登录成功',
    data: {
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    }
  })
}))

/**
 * POST /api/auth/logout
 * 用户登出接口
 *
 * 功能：记录登出日志
 * 注意：JWT token无法在服务端主动失效，客户端需要删除token
 */
router.post('/logout', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown'

  // 记录登出日志
  if (userId) {
    await prisma.operationLog.create({
      data: {
        userId,
        operationType: 'logout',
        operationContent: '用户登出',
        ipAddress: clientIp
      }
    })
  }

  res.json({
    code: 200,
    message: '登出成功',
    data: null
  })
}))

/**
 * GET /api/auth/user-info
 * 获取当前用户信息
 *
 * 需要认证：携带有效的JWT token
 */
router.get('/user-info', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id

  if (!userId) {
    throw new AuthError('未认证')
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      role: true,
      status: true,
      lastLoginTime: true
    }
  })

  if (!user) {
    throw new AuthError('用户不存在')
  }

  const userInfo: UserInfoResponse = {
    ...user,
    lastLoginTime: user.lastLoginTime ? user.lastLoginTime.toISOString() : null
  }

  res.json({
    code: 200,
    message: '获取用户信息成功',
    data: userInfo
  })
}))

/**
 * POST /api/auth/change-password
 * 修改密码接口
 *
 * 需要认证：携带有效的JWT token
 * 功能：验证旧密码，设置新密码
 */
router.post('/change-password', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id
  const { oldPassword, newPassword } = req.body as ChangePasswordRequest

  // 参数验证
  if (!oldPassword || !newPassword) {
    throw new ValidationError('旧密码和新密码不能为空')
  }

  // 密码强度验证
  if (newPassword.length < 6) {
    throw new ValidationError('新密码长度不能少于6位')
  }

  if (!userId) {
    throw new AuthError('未认证')
  }

  // 查询用户
  const user = await prisma.user.findUnique({
    where: { id: userId }
  })

  if (!user) {
    throw new AuthError('用户不存在')
  }

  // 验证旧密码
  const isOldPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash)
  if (!isOldPasswordValid) {
    throw new BusinessError('旧密码错误')
  }

  // 新密码不能与旧密码相同
  const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash)
  if (isSamePassword) {
    throw new BusinessError('新密码不能与旧密码相同')
  }

  // 生成新密码哈希
  const newPasswordHash = await bcrypt.hash(newPassword, 10)

  // 更新密码
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newPasswordHash }
  })

  // 记录操作日志
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown'
  await prisma.operationLog.create({
    data: {
      userId,
      operationType: 'change_password',
      operationContent: '用户修改密码',
      ipAddress: clientIp
    }
  })

  res.json({
    code: 200,
    message: '密码修改成功',
    data: null
  })
}))

export default router