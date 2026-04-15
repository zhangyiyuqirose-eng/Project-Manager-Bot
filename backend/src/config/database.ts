import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import 'dotenv/config'
import path from 'path'

const dbPath = path.resolve(process.cwd(), process.env.DATABASE_URL?.replace('file:', '') || './dev.db')

declare global {
  var prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaLibSql({
    url: `file:${dbPath}`
  })

  return new PrismaClient({
    adapter,
    log: ['error']
  })
}

const prisma = global.prisma || createPrismaClient()

if (process.env.NODE_ENV === 'development') {
  global.prisma = prisma
}

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

export async function disconnect(): Promise<void> {
  await prisma.$disconnect()
}

export async function transaction<T>(
  fn: (prisma: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>
): Promise<T> {
  return prisma.$transaction(fn)
}

export default prisma
export { prisma }