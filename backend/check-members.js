const { PrismaClient } = require('@prisma/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');
const path = require('path');

// 正确初始化PrismaClient with LibSQL adapter
const dbPath = path.resolve(process.cwd(), './dev.db');
const adapter = new PrismaLibSql({
  url: `file:${dbPath}`
});

const prisma = new PrismaClient({
  adapter,
  log: ['query', 'info', 'warn', 'error']
});

(async () => {
  try {
    // 查询项目成员
    const members = await prisma.projectMember.findMany({
      where: { projectId: 7 }
    });
    
    console.log('项目成员:', members);
    
    // 查询项目成本信息
    const projectCost = await prisma.projectCost.findFirst({
      where: { projectId: 7 }
    });
    
    console.log('项目成本信息:', projectCost);
    
  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    await prisma.$disconnect();
  }
})();