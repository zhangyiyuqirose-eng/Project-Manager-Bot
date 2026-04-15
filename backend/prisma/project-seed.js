const { PrismaClient } = require('@prisma/client')
const { PrismaLibSql } = require('@prisma/adapter-libsql')

const adapter = new PrismaLibSql({ url: 'file:./dev.db' })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('开始初始化项目数据...')
  
  const pmUser = await prisma.user.findUnique({ where: { username: 'pm' } })
  if (!pmUser) {
    console.error('找不到pm用户，请先运行用户种子脚本')
    return
  }
  
  const projects = [
    {
      userId: pmUser.id,
      projectCode: 'P001',
      projectName: '北京银行数字化转型项目',
      projectType: 'software',
      contractAmount: 500.00,
      preSaleRatio: 0.1,
      taxRate: 0.06,
      externalLaborCost: 50.00,
      externalSoftwareCost: 30.00,
      otherCost: 20.00,
      currentManpowerCost: 100.00,
      status: 'ongoing',
    },
    {
      userId: pmUser.id,
      projectCode: 'P002',
      projectName: '智能风控系统建设项目',
      projectType: 'software',
      contractAmount: 300.00,
      preSaleRatio: 0.15,
      taxRate: 0.06,
      externalLaborCost: 30.00,
      externalSoftwareCost: 20.00,
      otherCost: 10.00,
      currentManpowerCost: 80.00,
      status: 'ongoing',
    },
    {
      userId: pmUser.id,
      projectCode: 'P003',
      projectName: '移动银行APP升级项目',
      projectType: 'software',
      contractAmount: 200.00,
      preSaleRatio: 0.05,
      taxRate: 0.06,
      externalLaborCost: 15.00,
      externalSoftwareCost: 10.00,
      otherCost: 5.00,
      currentManpowerCost: 50.00,
      status: 'completed',
    },
  ]
  
  for (const project of projects) {
    try {
      const created = await prisma.project.upsert({
        where: { projectCode: project.projectCode },
        update: {},
        create: project,
      })
      console.log(`创建项目: ${project.projectCode} (${project.projectName})`)
      
      const members = [
        { projectId: created.id, name: '张伟', department: '开发部', level: 'P7', dailyCost: 0.25, role: '技术负责人', isToEnd: true },
        { projectId: created.id, name: '李明', department: '开发部', level: 'P6', dailyCost: 0.18, role: '开发工程师', isToEnd: true },
        { projectId: created.id, name: '王芳', department: '测试部', level: 'P6', dailyCost: 0.16, role: '测试工程师', isToEnd: false },
      ]
      
      for (const member of members) {
        await prisma.projectMember.upsert({
          where: { projectId_name: { projectId: created.id, name: member.name } },
          update: {},
          create: member,
        })
      }
      console.log(`  添加了 ${members.length} 个成员`)
      
      await prisma.projectCost.create({
        data: {
          projectId: created.id,
          contractAmount: project.contractAmount,
          preSaleRatio: project.preSaleRatio,
          taxRate: project.taxRate,
          externalLaborCost: project.externalLaborCost,
          externalSoftwareCost: project.externalSoftwareCost,
          otherCost: project.otherCost,
          currentManpowerCost: project.currentManpowerCost,
          availableCost: project.contractAmount * (1 - project.preSaleRatio) * (1 - project.taxRate) - project.externalLaborCost - project.externalSoftwareCost - project.otherCost - project.currentManpowerCost,
          dailyManpowerCost: 0.2,
          availableDays: Math.floor((project.contractAmount * (1 - project.preSaleRatio) * (1 - project.taxRate) - project.externalLaborCost - project.externalSoftwareCost - project.otherCost) / 0.2),
        }
      })
      console.log(`  创建了成本记录`)
      
    } catch (e) {
      console.log(`项目已存在或错误: ${project.projectCode}`)
    }
  }
  
  console.log('\n项目数据初始化完成！')
  console.log('测试项目编号: P001, P002, P003')
}

main()
  .catch((e) => {
    console.error('初始化失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })