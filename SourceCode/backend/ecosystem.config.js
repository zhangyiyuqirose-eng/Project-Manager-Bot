module.exports = {
  apps: [{
    name: 'pm-backend',
    script: './dist/server.js',
    cwd: '/data/disk/projects/Project-Manager-Bot/SourceCode/backend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3300
    }
  }]
};