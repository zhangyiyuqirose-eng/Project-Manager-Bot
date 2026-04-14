# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IT项目智能成本管控平台 (IT Project Intelligent Cost Management Platform) - An enterprise application for IT project cost estimation, consumption tracking, and deviation monitoring.

## Architecture

### Monorepo Structure
- `frontend/` - React + Vite + TypeScript web application
- `backend/` - Express + TypeScript API server
- `OCRService/` - Python FastAPI OCR service (EasyOCR)

### Frontend Stack
- React 19 + TypeScript + Vite
- Ant Design 6.x for UI components
- Zustand for state management
- React Router for navigation
- Axios for API communication (with separate instances for AI operations: 3min timeout)
- Playwright for E2E testing

### Backend Stack
- Express 5.x + TypeScript (CommonJS modules)
- Prisma 7.x ORM with libsql adapter (SQLite database)
- JWT authentication (currently bypassed in frontend)
- Winston for logging
- Multer for file uploads
- External AI API integration (MiniMax-M2.5 model for document parsing via Finna API, EasyOCR for OCR)

### OCRService Stack
- FastAPI + Uvicorn server (Python 3.10+)
- EasyOCR for text recognition (supports Chinese/English)
- Pydantic for data validation
- Runs on port 8868 by default

## Development Commands

### Backend
```bash
cd backend
npm install          # Install dependencies
npm run dev          # Start dev server with nodemon (port 3000)
npm run build        # Compile TypeScript to dist/
npm run start        # Run compiled server
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema changes to database
npm run db:migrate   # Create and apply migrations
npm run db:studio    # Open Prisma Studio GUI
```

### Frontend
```bash
cd frontend
npm install          # Install dependencies
npm run dev          # Start dev server (port 5173, proxies to backend)
npm run build        # Type-check + build for production
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

**Path Alias**: `@` maps to `frontend/src/` (configured in vite.config.ts)

### OCRService
```bash
cd OCRService
pip install -r requirements.txt  # Install Python dependencies
python app.py                    # Start OCR server (port 8868)
# Or with Docker:
docker-compose up -d             # Start OCR service in Docker
```

### E2E Testing
```bash
cd frontend
npm exec playwright test              # Run all E2E tests
npm exec playwright test --ui         # Run with UI
npm exec playwright test --debug      # Debug mode
```

## Key Patterns

### API Response Format
```typescript
interface ApiResponse<T> {
  code: number      // 0 or 200 for success
  message: string
  data: T | null
  meta?: {          // Pagination metadata
    total: number
    page: number
    limit: number
    totalPages: number
  }
}
```

### Frontend API Instances
- `api` - Standard requests (30s timeout)
- `aiApi` - AI operations (180s timeout for document parsing, OCR, calculations)

### State Management
- `useUserStore` - User authentication state (persisted in localStorage, currently defaults to logged-in)
- `useProjectStore` - Current project and project list
- `useGlobalStore` - Loading state overlay

**Frontend Source Structure** (`frontend/src/`):
- `main.tsx` - Entry point
- `App.tsx` - React Router configuration
- `api/index.ts` - Axios instances (`api` for standard requests, `aiApi` for AI operations) and API methods
- `store/userStore.ts` - Zustand stores (user, project, global)
- `types/index.ts` - TypeScript type definitions
- `components/common/` - Shared components (Layout, PageHeader, EstimateSteps, etc.)
- `pages/` - Route page components organized by module

### OCRService API Endpoints (port 8868)
- `GET /health` - Health check (returns engine_ready status)
- `POST /ocr/recognize` - Basic OCR recognition (returns text lines + confidence)
- `POST /ocr/structured` - Structured data extraction (core endpoint)
  - `extract_type: "consumption"` - Returns financial data for cost consumption
  - `extract_type: "deviation"` - Returns project data for deviation monitoring
- `POST /ocr/recognize-batch` - Batch recognition for multiple images

### OCRService Data Extraction
The OCRService extracts structured data from OA screenshots using regex patterns:
- **Financial patterns**: 合同金额, 售前比例, 税率, 人力成本, 外采成本
- **Member patterns**: 姓名, 职级(P5-P8), 角色, 工时

### Backend Route Structure
Routes are mounted under `/api/`:
- `/api/auth` - Authentication (login, logout, user-info)
- `/api/dashboard` - Dashboard statistics
- `/api/projects` - Project CRUD operations
- `/api/estimate` - Implementation cost estimation (5-step workflow)
- `/api/consumption` - Cost consumption estimation
- `/api/deviation` - Cost deviation monitoring

**Backend Source Structure** (`backend/src/`):
- `server.ts` - Entry point
- `app.ts` - Express app configuration
- `routes/` - API route handlers (auth, projects, estimate, consumption, deviation, dashboard)
- `middlewares/` - Auth, error handler, logger
- `services/aiService.ts` - AI integration (document parsing, OCR, deviation analysis)
- `config/database.ts` - Prisma client configuration
- `types/index.ts` - TypeScript type definitions

### Frontend Routing
**实施成本预估** (Cost Estimate - 5-step workflow):
1. `/cost-estimate/upload` - Document upload
2. `/cost-estimate/project-info` - Project information
3. `/cost-estimate/ai-analysis` - AI parsing results
4. `/cost-estimate/config` - Configuration parameters
5. `/cost-estimate/result` - Calculation results

**成本消耗预估** (Cost Consumption - 2-step workflow):
- `/cost-consumption/input` - OCR upload and project info
- `/cost-consumption/result` - Cost calculation result

**成本偏差监控** (Cost Deviation - 3-step workflow):
- `/cost-deviation/input` - Upload screenshots and AI recognition
- `/cost-deviation/member-list` - Member management
- `/cost-deviation/result` - Deviation analysis and AI suggestion

**项目管理**:
- `/project/list` - Project list
- `/project/detail/:projectId` - Project detail

**其他**:
- `/dashboard` - Dashboard overview
- `/user/setting` - User settings

## Database Schema

Key models (see `backend/prisma/schema.prisma`):
- `User` - User accounts with role-based permissions
- `Project` - Projects with contract info, cost fields, status
- `ProjectDocument` - Uploaded requirement documents
- `EstimateConfig` - Cost estimation parameters
- `EstimateResult` - Calculation results
- `ProjectMember` - Team members with level (P5/P6/P7/P8), daily cost
- `ProjectCost` - Consumption tracking data
- `CostDeviation` - Deviation monitoring records

## AI Integration

Backend uses external AI services:
- **Document Parsing**: MiniMax-M2.5 model via Finna API (OpenAI-compatible format, non-streaming mode for JSON stability)
- **OCR**: Local OCRService (EasyOCR on port 8868) for screenshot text recognition

### OCRService Architecture
The OCRService is a standalone Python FastAPI service:
- Uses EasyOCR engine with Chinese/English support (`ch_sim`, `en`)
- Lazy initialization (loads model on first request)
- GPU optional (configurable via `USE_GPU` env var)
- Returns structured data for consumption/deviation modules

**OCRService Files**:
- `app.py` - FastAPI endpoints
- `ocr_engine.py` - EasyOCR engine wrapper
- `schemas.py` - Pydantic request/response models
- `utils.py` - Regex extraction patterns for financial/member data

**OCRService Configuration** (see OCRService/.env):
- `USE_GPU` - Enable GPU acceleration
- `LANG` - OCR language (default: `ch`)
- `PORT` - Service port (default: 8868)

**AI API Configuration** (see backend/.env):
- `AI_API_URL` - Finna API endpoint
- `AI_API_KEY` - API key for authentication
- `AI_MODEL` - Model name (currently: MiniMax-M2.5)
- `AI_MOCK` - Enable mock mode when AI service unavailable (default: false)

## Environment Variables

Backend `.env` required:
- `DATABASE_URL` - SQLite file path (e.g., `file:./dev.db`)
- `PORT` - Server port (default 3000)
- `JWT_SECRET`, `JWT_EXPIRES_IN` - Auth config
- `AI_API_URL`, `AI_API_KEY`, `AI_MODEL` - AI text model config
- `OCR_PROVIDER`, `PADDLEOCR_URL` - OCR service config (points to OCRService)

OCRService `.env` required:
- `USE_GPU` - Enable GPU (default: false)
- `LANG` - OCR language (default: ch)
- `PORT` - Service port (default: 8868)

## Notes

- Authentication is currently bypassed in frontend (default logged-in state in userStore)
- AI API calls have extended timeouts (180s) - use `aiApi` instance for these
- Prisma uses libsql adapter for SQLite in Prisma 7.x
- Frontend proxies `/api/*` requests to backend at `localhost:3000`