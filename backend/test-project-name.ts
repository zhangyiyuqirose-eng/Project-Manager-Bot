import prisma from './src/config/database'

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

    process.stdout.write('保存的项目信息: ' + JSON.stringify(project) + '\n')

    // 测试查询项目信息
    const queriedProject = await prisma.project.findFirst({
      where: { projectCode: 'P006' }
    })

    process.stdout.write('查询的项目信息: ' + JSON.stringify(queriedProject) + '\n')

    // 测试更新项目信息
    const updatedProject = await prisma.project.update({
      where: { id: project.id },
      data: {
        projectName: '更新后的测试项目6'
      }
    })

    process.stdout.write('更新后的项目信息: ' + JSON.stringify(updatedProject) + '\n')

    // 测试查询更新后的项目信息
    const queriedUpdatedProject = await prisma.project.findFirst({
      where: { projectCode: 'P006' }
    })

    process.stdout.write('查询更新后的项目信息: ' + JSON.stringify(queriedUpdatedProject) + '\n')

  } catch (error) {
    process.stdout.write('测试失败: ' + error + '\n')
  } finally {
    await prisma.$disconnect()
  }
}

testProjectName()