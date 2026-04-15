const { PrismaClient } = require('@prisma/client')
const { PrismaLibSql } = require('@prisma/adapter-libsql')
const bcrypt = require('bcryptjs')

const dbPath = './dev.db'
const adapter = new PrismaLibSql({
  url: `file:${dbPath}`
})

const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('开始初始化数据...')
  
  const hashedPassword = await bcrypt.hash('123456', 10)
  
  const users = [
    { username: 'pm', name: '张三', email: 'pm@example.com', role: 'pm' },
    { username: 'supervisor', name: '李四', email: 'supervisor@example.com', role: 'supervisor' },
    { username: 'dept_head', name: '王五', email: 'dept_head@example.com', role: 'department_head' },
    { username: 'finance', name: '赵六', email: 'finance@example.com', role: 'finance' },
  ]
  
  for (const user of users) {
    try {
      const created = await prisma.user.upsert({
        where: { username: user.username },
        update: {},
        create: {
          username: user.username,
          passwordHash: hashedPassword,
          name: user.name,
          email: user.email,
          role: user.role,
          status: 'active',
        },
      })
      console.log(`创建用户: ${user.username} (${user.name})`)
    } catch (e) {
      console.log(`用户已存在或错误: ${user.username}`)
    }
  }
  
  console.log('\n初始化完成！')
  console.log('测试账号信息（密码均为: 123456）：')
  console.log('项目经理: 用户名: pm')
  console.log('项目总监: 用户名: supervisor')
  console.log('部门负责人: 用户名: dept_head')
  console.log('财务人员: 用户名: finance')
}

main()
  .catch((e) => {
    console.error('初始化失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })