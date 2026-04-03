// 初始化脚本 - 创建默认用户
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('开始初始化数据...')

  // 创建测试用户
  const hashedPassword = await bcrypt.hash('123456', 10)

  // 项目经理用户
  const pm = await prisma.user.upsert({
    where: { username: 'pm' },
    update: {},
    create: {
      username: 'pm',
      passwordHash: hashedPassword,
      name: '张三',
      email: 'zhangsan@example.com',
      role: 'pm',
      status: 'active',
    },
  })

  console.log('创建项目经理用户:', pm)

  // 项目总监用户
  const supervisor = await prisma.user.upsert({
    where: { username: 'supervisor' },
    update: {},
    create: {
      username: 'supervisor',
      passwordHash: hashedPassword,
      name: '李四',
      email: 'lisi@example.com',
      role: 'supervisor',
      status: 'active',
    },
  })

  console.log('创建项目总监用户:', supervisor)

  // 部门负责人用户
  const departmentHead = await prisma.user.upsert({
    where: { username: 'dept_head' },
    update: {},
    create: {
      username: 'dept_head',
      passwordHash: hashedPassword,
      name: '王五',
      email: 'wangwu@example.com',
      role: 'department_head',
      status: 'active',
    },
  })

  console.log('创建部门负责人用户:', departmentHead)

  // 财务用户
  const finance = await prisma.user.upsert({
    where: { username: 'finance' },
    update: {},
    create: {
      username: 'finance',
      passwordHash: hashedPassword,
      name: '赵六',
      email: 'zhaoliu@example.com',
      role: 'finance',
      status: 'active',
    },
  })

  console.log('创建财务用户:', finance)

  console.log('\n初始化完成！')
  console.log('测试账号信息：')
  console.log('----------------------------------------')
  console.log('项目经理:   用户名: pm, 密码: 123456')
  console.log('项目总监:   用户名: supervisor, 密码: 123456')
  console.log('部门负责人: 用户名: dept_head, 密码: 123456')
  console.log('财务人员:   用户名: finance, 密码: 123456')
  console.log('----------------------------------------')
}

main()
  .catch((e) => {
    console.error('初始化失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })