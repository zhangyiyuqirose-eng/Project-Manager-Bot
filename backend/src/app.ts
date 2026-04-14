import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth'
import dashboardRoutes from './routes/dashboard'
import projectRoutes from './routes/projects'
import estimateRoutes from './routes/estimate'
import consumptionRoutes from './routes/consumption'
import deviationRoutes from './routes/deviation'
import { errorHandler } from './middlewares/errorHandler'
import { requestLogger } from './middlewares/logger'
import { authLimiter, apiLimiter, aiLimiter } from './middlewares/rateLimit'

const app = express()

// 基础中间件
app.use(cors())

// 确保所有响应都使用 UTF-8 编码
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  next()
})

app.use(express.json({ limit: '50mb', strict: true }))
app.use(express.urlencoded({ extended: true, limit: '50mb', parameterLimit: 1000000 }))

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

// 请求日志
app.use(requestLogger)

// API 通用限流
app.use('/api', apiLimiter)

// 认证端点严格限流（防止暴力破解）
app.use('/api/auth/login', authLimiter)

// AI 端点宽松限流（AI调用耗时较长）
app.use('/api/estimate', aiLimiter)
app.use('/api/consumption', aiLimiter)
app.use('/api/deviation', aiLimiter)

// API路由
app.use('/api/auth', authRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/estimate', estimateRoutes)
app.use('/api/consumption', consumptionRoutes)
app.use('/api/deviation', deviationRoutes)

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 404处理
app.use((req, res) => {
  res.status(404).json({ code: 404, message: '接口不存在' })
})

// 全局错误处理
app.use(errorHandler)

export default app