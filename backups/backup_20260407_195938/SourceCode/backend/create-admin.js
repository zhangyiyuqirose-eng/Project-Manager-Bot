const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const db = new Database('./data.db');

const passwordHash = bcrypt.hashSync('admin123', 10);

try {
  const stmt = db.prepare(`
    INSERT INTO users (username, password_hash, name, role, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `);
  stmt.run('admin', passwordHash, 'Admin', 'pm');
  console.log('Admin user created successfully!');
} catch (error) {
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    console.log('Admin user already exists');
  } else {
    console.error('Error:', error.message);
  }
}

const users = db.prepare('SELECT id, username, name, role FROM users').all();
console.log('Users:', users);

db.close();