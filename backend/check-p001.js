const { PrismaClient } = require('@prisma/client')
const { PrismaLibSql } = require('@prisma/adapter-libsql')

const adapter = new PrismaLibSql({ url: 'file:./dev.db' })
const prisma = new PrismaClient({ adapter })

async function main() {
  const project = await prisma.project.findFirst({
    where: { projectCode: 'P001' },
    include: { members: true }
  })
  console.log('Project P001:', JSON.stringify(project, null, 2))
}

main()
  .catch(e => console.error('Error:', e))
  .finally(() => prisma.$disconnect())