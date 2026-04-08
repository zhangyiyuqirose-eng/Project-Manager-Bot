// 简化的初始化脚本 - 使用 better-sqlite3
const Database = require('better-sqlite3')
const bcrypt = require('bcryptjs')
const path = require('path')

const dbPath = path.join(__dirname, '..', 'dev.db')
const db = new Database(dbPath)

// 创建密码哈希
const hashedPassword = bcrypt.hashSync('123456', 10)

// 插入用户
const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (username, password_hash, name, email, role, status)
  VALUES (?, ?, ?, ?, ?, ?)
`)

// 创建测试用户
const users = [
  { username: 'pm', name: '张三', email: 'pm@example.com', role: 'pm' },
  { username: 'supervisor', name: '李四', email: 'supervisor@example.com', role: 'supervisor' },
  { username: 'dept_head', name: '王五', email: 'dept_head@example.com', role: 'department_head' },
  { username: 'finance', name: '赵六', email: 'finance@example.com', role: 'finance' },
]

console.log('开始初始化数据...')

for (const user of users) {
  const result = insertUser.run(
    user.username,
    hashedPassword,
    user.name,
    user.email,
    user.role,
    'active'
  )
  if (result.changes > 0) {
    console.log(`创建用户: ${user.username} (${user.name})`)
  } else {
    console.log(`用户已存在: ${user.username}`)
  }
}

console.log('\n初始化完成！')
console.log('========================================')
console.log('测试账号信息（密码均为: 123456）：')
console.log('----------------------------------------')
console.log('项目经理:   用户名: pm')
console.log('项目总监:   用户名: supervisor')
console.log('部门负责人: 用户名: dept_head')
console.log('财务人员:   用户名: finance')
console.log('========================================')

db.close()