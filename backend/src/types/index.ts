import { Request } from 'express'

// ==================== 通用类型 ====================

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T | null
}

export interface PaginatedData<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

// ==================== 认证相关类型 ====================

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  user: {
    id: number
    username: string
    name: string
    role: string
  }
}

// ==================== 项目相关类型 ====================

export interface CreateProjectRequest {
  projectName: string
  projectType?: string
  contractAmount?: number
}

export interface UpdateProjectRequest {
  projectName?: string
  projectType?: string
  contractAmount?: number
  status?: 'ongoing' | 'completed' | 'paused' | 'cancelled'
}

export interface ProjectResponse {
  id: number
  userId: number
  projectName: string
  projectType: string | null
  contractAmount: number | null
  status: string
  createdAt: Date
  updatedAt: Date
}

// ==================== 实施成本预估相关类型 ====================

export interface UploadDocumentResponse {
  documentId: number
  docName: string
  docPath: string
}

export interface ParseDocumentResponse {
  documentId: number
  parseStatus: string
  parseResult: ParseResult | null
}

export interface ParseResult {
  modules: ModuleInfo[]
  totalModules: number
  rawText?: string
  projectName?: string
  systemName?: string
}

export interface ModuleInfo {
  name: string
  description?: string
  features?: string[]
  functions?: FunctionInfo[]  // 新增：功能点列表（参考Python版本）
  complexity?: 'simple' | 'medium' | 'complex'
  estimatedManDays?: number
  associationSystems?: number
}

// 新增：功能点信息（参考Python版本结构）
export interface FunctionInfo {
  name: string
  complexity: 'very_basic' | 'basic' | 'medium' | 'complex' | 'very_complex'
  association_systems?: number  // 关联系统数量
  association_coeff?: number    // 关联度系数（可选，如果直接提供）
}

export interface ComplexityConfig {
  simple: number
  medium: number
  complex: number
}

export interface SystemCoefficient {
  distributed: number
  microservice: number
  monomer: number
}

export interface ProcessCoefficient {
  agile: number
  waterfall: number
  hybrid: number
}

export interface TechStackCoefficient {
  java: number
  python: number
  nodejs: number
  dotnet: number
  go: number
}

export interface UnitPriceConfig {
  P5: number
  P6: number
  P7: number
  P8: number
}

export interface EstimateConfigRequest {
  complexityConfig?: ComplexityConfig
  systemCoefficient?: SystemCoefficient
  processCoefficient?: ProcessCoefficient
  techStackCoefficient?: TechStackCoefficient
  unitPriceConfig?: UnitPriceConfig
  managementCoefficient?: number
}

export interface EstimateConfigResponse {
  id: number
  projectId: number
  complexityConfig: ComplexityConfig
  systemCoefficient: SystemCoefficient
  processCoefficient: ProcessCoefficient
  techStackCoefficient: TechStackCoefficient
  unitPriceConfig: UnitPriceConfig
  managementCoefficient: number
}

export interface CalculateEstimateRequest {
  configId?: number
}

export interface StageDetail {
  stage: string
  manDays: number
  percentage: number
  cost: number
  description: string
}

export interface TeamDetail {
  level: string
  count: number
  dailyCost: number
  totalCost: number
  manDays: number
}

export interface CalculateEstimateResponse {
  totalManDay: number
  totalCost: number
  moduleCount: number
  manMonth: number
  stageDetail: StageDetail[]
  teamDetail: TeamDetail[]
  calcTrace: CalcTraceItem[]
  traces?: FunctionTrace[]        // 新增：详细功能点计算轨迹
  compliance?: ComplianceResult   // 新增：合规校验结果
  totalItems?: number             // 新增：功能点总数
}

export interface CalcTraceItem {
  step: string
  input: Record<string, unknown>
  output: Record<string, unknown>
  formula?: string
}

// 新增：功能点计算轨迹（参考Python版本 traces 结构）
export interface FunctionTrace {
  module: string
  function: string
  complexity: string
  base: number              // 复杂度基准人天
  assoc: number             // 关联度系数
  assoc_systems: number     // 关联系统数量
  tech_stack: number        // 技术栈系数
  mgmt: number              // 管理系数
  phases: Record<string, {
    flow_coeff: number      // 流程系数
    uses_tech_stack: boolean
    raw: number             // 原始计算值（含管理系数）
    workload: number        // 最终工作量
  }>
}

// 新增：合规校验详情（参考Python版本 compliance 结构）
export interface ComplianceDetail {
  pass: boolean
  days: number
  pct: number
  min: number
  max: number
}

export interface ComplianceResult {
  all_pass: boolean
  details: Record<string, ComplianceDetail>
}

// ==================== 成本消耗预估相关类型 ====================

export interface OcrResult {
  projectInfo: {
    projectName?: string
    projectManager?: string
    startDate?: string
    endDate?: string
    status?: string
  }
  memberInfo: Array<{
    name: string
    level: string
    role?: string
    reportedHours?: number
  }>
  // OCR 识别的财务数据
  contractAmount?: number
  preSaleRatio?: number
  taxRate?: number
  externalLaborCost?: number
  externalSoftwareCost?: number
  currentManpowerCost?: number
  rawText?: string
}

export interface SaveProjectInfoRequest {
  contractAmount: number
  preSaleRatio?: number
  taxRate?: number
  externalLaborCost?: number
  externalSoftwareCost?: number
  otherCost?: number
  members: ProjectMemberInput[]
}

export interface ProjectMemberInput {
  name: string
  department?: string
  level: 'P5' | 'P6' | 'P7' | 'P8'
  dailyCost: number
  role?: string
  entryTime?: string
  leaveTime?: string
  isToEnd?: boolean
  reportedHours?: number
}

export interface AdjustMembersRequest {
  members: ProjectMemberInput[]
}

export interface ConsumptionResult {
  contractAmount: number
  preSaleRatio: number
  taxRate: number
  externalLaborCost: number
  externalSoftwareCost: number
  otherCost: number
  currentManpowerCost: number
  availableCost: number
  dailyManpowerCost: number
  availableDays: number
  burnoutDate: string | null
  members: MemberCostDetail[]
}

export interface MemberCostDetail {
  id: number
  name: string
  department: string | null
  level: string
  dailyCost: number
  role: string | null
  entryTime: string | null
  leaveTime: string | null
  isToEnd?: boolean
  reportedHours: number | null
  totalCost: number
}

// ==================== 成本偏差监控相关类型 ====================

export interface RecognizeResult {
  totalContractAmount: number
  currentCostConsumption: number
  taskProgress: number
  stageInfo: StageInfo[]
  projectName?: string
  members?: Array<{
    name: string
    level: string
    role?: string
    reportedHours?: number
  }>
  rawText?: string
}

export interface StageInfo {
  name: string
  plannedProgress: number
  actualProgress: number
  plannedCost?: number
  actualCost?: number
}

export interface SaveBaselineRequest {
  baselineType: 'default' | 'custom'
  baselineConfig?: Record<string, unknown>
  expectedStages?: StageInfo[]
}

export interface CalculateDeviationRequest {
  actualStages?: StageInfo[]
}

export interface DeviationResult {
  totalContractAmount: number
  currentCostConsumption: number
  taskProgress: number
  costDeviation: number
  deviationStatus: 'normal' | 'warning' | 'critical'
  baselineType: string
  expectedStages: StageInfo[]
  actualStages: StageInfo[]
  teamCosts: TeamCostInfo[]
  aiSuggestion: string | null
}

export interface TeamCostInfo {
  team: string
  plannedCost: number
  actualCost: number
  deviation: number
  deviationRate: number
}

export interface ExportReportResponse {
  filePath: string
  fileName: string
}

// ==================== 请求扩展类型 ====================

export interface AuthenticatedRequest extends Request {
  userId: number
  user: {
    id: number
    username: string
    name: string
    role: string
  }
}