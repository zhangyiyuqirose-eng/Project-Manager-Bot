const { PrismaClient } = require('@prisma/client')
const { PrismaLibSql } = require('@prisma/adapter-libsql')

const adapter = new PrismaLibSql({ url: 'file:./dev.db' })
const prisma = new PrismaClient({ adapter })

async function main() {
  // 更新所有项目的projectType
  const result = await prisma.project.updateMany({
    where: {
      projectType: 'software'
    },
    data: {
      projectType: 'implementation'
    }
  })

  console.log(`Updated ${result.count} projects from 'software' to 'implementation'`)

  // 验证更新结果
  const projects = await prisma.project.findMany()
  console.log('\nAll projects:')
  projects.forEach(p => {
    console.log(`  ${p.projectCode}: ${p.projectType}`)
  })
}

main()
  .catch(e => console.error('Error:', e))
  .finally(() => prisma.$disconnect())