const { PrismaClient } = require('@prisma/client')
const { PrismaLibSql } = require('@prisma/adapter-libsql')

const adapter = new PrismaLibSql({ url: 'file:./dev.db' })
const prisma = new PrismaClient({ adapter })

async function main() {
  const projects = await prisma.project.findMany()
  console.log('Projects:', JSON.stringify(projects, null, 2))
}

main()
  .catch(e => console.error('Error:', e))
  .finally(() => prisma.$disconnect())