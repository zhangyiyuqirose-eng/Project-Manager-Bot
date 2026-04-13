const { PrismaClient } = require('@prisma/client')
const { PrismaLibSql } = require('@prisma/adapter-libsql')

// 使用与项目相同的数据库配置
const dbPath = './dev.db'
const adapter = new PrismaLibSql({
  url: `file:${dbPath}`
})

const prisma = new PrismaClient({
  adapter,
  log: ['query', 'info', 'warn', 'error']
})

async function testProjectName() {
  try {
    // 测试保存项目信息
    const project = await prisma.project.create({
      data: {
        userId: 1,
        projectCode: 'P006',
        projectName: '测试项目6',
        projectType: 'software',
        status: 'ongoing',
        contractAmount: 6000000,
        preSaleRatio: 0.1,
        taxRate: 0.06,
        externalLaborCost: 600000,
        externalSoftwareCost: 300000,
        otherCost: 120000,
        currentManpowerCost: 0
      }
    })

    console.log('保存的项目信息:', project)

    // 测试查询项目信息
    const queriedProject = await prisma.project.findFirst({
      where: { projectCode: 'P006' }
    })

    console.log('查询的项目信息:', queriedProject)

    // 测试更新项目信息
    const updatedProject = await prisma.project.update({
      where: { id: project.id },
      data: {
        projectName: '更新后的测试项目6'
      }
    })

    console.log('更新后的项目信息:', updatedProject)

    // 测试查询更新后的项目信息
    const queriedUpdatedProject = await prisma.project.findFirst({
      where: { projectCode: 'P006' }
    })

    console.log('查询更新后的项目信息:', queriedUpdatedProject)

  } catch (error) {
    console.error('测试失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testProjectName()