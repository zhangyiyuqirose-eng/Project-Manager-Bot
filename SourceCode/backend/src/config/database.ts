import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import 'dotenv/config'

/**
 * Prisma 客户端单例配置
 * 在开发环境中避免因热重载创建多个连接实例
 * Prisma 7.x 使用 adapter 模式
 */

// 声明全局变量以防止在开发模式下创建多个实例
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

/**
 * 创建 Prisma 客户端实例
 * 使用 libsql adapter 连接 SQLite
 */
function createPrismaClient(): PrismaClient {
  const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './dev.db'

  // libsql 适配器配置
  const adapter = new PrismaLibSql({
    url: `file:${dbPath}`
  })

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'info', 'warn', 'error']
      : ['error']
  })
}

// 在开发环境中使用全局变量存储实例，避免热重载时重复创建
const prisma = global.prisma || createPrismaClient()

if (process.env.NODE_ENV === 'development') {
  global.prisma = prisma
}

/**
 * 数据库连接测试
 */
export async function testConnection(): Promise<boolean> {
  try {
    await prisma.$connect()
    console.log('✅ 数据库连接成功')
    return true
  } catch (error) {
    console.error('❌ 数据库连接失败:', error)
    return false
  }
}

/**
 * 数据库断开连接
 */
export async function disconnect(): Promise<void> {
  await prisma.$disconnect()
}

/**
 * 执行事务操作
 */
export async function transaction<T>(
  fn: (prisma: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>
): Promise<T> {
  return prisma.$transaction(fn)
}

export default prisma
export { prisma }