# 测试框架安装说明

本项目已配置 Vitest 测试框架，但需要安装以下依赖：

## Backend 安装命令

```bash
cd backend
npm install -D vitest @vitest/coverage-v8
```

## Frontend 安装命令

```bash
cd frontend
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @vitest/coverage-v8
```

## 运行测试

安装完成后，在 package.json 中添加以下 scripts：

### Backend scripts
```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

### Frontend scripts
```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

## 测试文件位置

- Backend: `src/__tests__/*.test.ts`
- Frontend: `src/__tests__/*.test.tsx`

## 覆盖率目标

- Backend: 50% (Phase 5 目标)
- Frontend: 30% (Phase 5 目标)