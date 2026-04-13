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

const app = express()

// 基础中间件
app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// 确保所有 API 响应都使用 UTF-8 编码
app.use('/api', (_req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  next()
})

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

// 请求日志
app.use(requestLogger)

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