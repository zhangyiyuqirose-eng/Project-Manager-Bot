import 'dotenv/config'
import app from './app'
import prisma, { testConnection, disconnect } from './config/database'

// 导出 prisma 客户端供其他模块使用
export { prisma }

const PORT = process.env.PORT || 3000

// 启动服务器
async function startServer() {
  try {
    // 测试数据库连接
    const connected = await testConnection()
    if (!connected) {
      console.error('数据库连接失败')
      process.exit(1)
    }

    // 启动HTTP服务
    app.listen(PORT, () => {
      console.log(`服务器启动成功: http://localhost:${PORT}`)
      console.log(`API文档: http://localhost:${PORT}/api/health`)
    })
  } catch (error) {
    console.error('服务器启动失败:', error)
    process.exit(1)
  }
}

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('\n正在关闭服务器...')
  await disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n正在关闭服务器...')
  await disconnect()
  process.exit(0)
})

startServer()