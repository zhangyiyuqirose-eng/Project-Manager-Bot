// 用户相关类型
export interface User {
  userId: number
  username: string
  name: string
  role: UserRole
  email?: string
  permissions: string[]
  createdAt: string
}

export type UserRole = 'pm' | 'supervisor' | 'department_head' | 'finance'

export interface LoginParams {
  username: string
  password: string
}

export interface LoginResult {
  token: string
  user: User
}

// 项目相关类型
export interface Project {
  projectId: number
  userId: number
  projectName: string
  projectType?: string
  contractAmount?: number
  status: ProjectStatus
  createdAt: string
  updatedAt: string
}

export type ProjectStatus = 'ongoing' | 'completed' | 'paused' | 'cancelled'

// 实施成本预估相关类型
export interface EstimateConfig {
  complexityConfig: ComplexityLevel[]
  systemCoefficientConfig: SystemCoefficient[]
  processCoefficientConfig: ProcessCoefficient[]
  techStackCoefficientConfig: TechStackCoefficient[]
  unitPriceConfig: UnitPrice[]
  managementCoefficient: number
}

export interface ComplexityLevel {
  level: string
  workdays: number
}

export interface SystemCoefficient {
  systemCount: number
  coefficient: number
}

export interface ProcessCoefficient {
  stage: string
  coefficient: number
}

export interface TechStackCoefficient {
  techType: string
  coefficient: number
}

export interface UnitPrice {
  role: string
  price: number
}

export interface EstimateResult {
  projectId: number
  totalManDay: number
  totalCost: number
  moduleCount: number
  manMonth: number
  stageBreakdown: StageBreakdown[]
  teamBreakdown: TeamBreakdown[]
  calculationTrace: CalculationTrace[]
}

export interface StageBreakdown {
  stage: string
  workdays: number
  cost: number
  ratio: number
}

export interface TeamBreakdown {
  team: string
  workdays: number
  cost: number
  ratio: number
}

export interface CalculationTrace {
  functionName: string
  complexityBase: number
  systemCoefficient: number
  processCoefficient: number
  techStackCoefficient: number
  managementCoefficient: number
  formula: string
  result: number
  timestamp: string
}

// 成本消耗预估相关类型
export interface CostConsumption {
  projectId: number
  contractAmount: number
  preSaleRatio: number
  taxRate: number
  externalLaborCost: number
  externalSoftwareCost: number
  currentManpowerCost: number
  teamMembers: TeamMember[]
  availableCost: number
  dailyManpowerCost: number
  availableDays: number
  burnoutDate: string
}

export interface TeamMember {
  memberId: number
  name: string
  level: MemberLevel
  dailyCost: number
  entryTime?: string
  leaveTime?: string
  reportedHours?: number
}

export type MemberLevel = 'P5' | 'P6' | 'P7' | 'P8'

// 成员等级对应的日成本（万元）
export const MEMBER_LEVEL_DAILY_COST: Record<MemberLevel, number> = {
  P5: 0.16,
  P6: 0.21,
  P7: 0.26,
  P8: 0.36,
}

// 成本偏差监控相关类型
export interface CostDeviation {
  projectId: number
  totalContractAmount: number
  currentCostConsumption: number
  taskProgress: number
  costDeviation: number
  expectedStages: StageCost[]
  actualStages: StageCost[]
  teamCosts: TeamCost[]
  aiSuggestion?: string
}

export interface StageCost {
  stage: string
  expectedCost: number
  expectedRatio: number
  actualCost: number
  actualRatio: number
  deviation: number
}

export interface TeamCost {
  team: string
  expectedCost: number
  actualCost: number
  deviation: number
}

// 成本偏差录入页相关类型
export interface ProjectMemberInfo {
  name: string
  role: string
  level: string
  reportedHours: number
}

export type BaselineMode = 'default' | 'custom'

export interface StageRatio {
  stage: string
  ratio: number
}

export interface DeviationBaseline {
  mode: BaselineMode
  stageRatios?: StageRatio[]
  file?: File
  expectedProfit?: number
}

// 仪表盘统计类型
export interface DashboardStats {
  totalProjects: number
  ongoingProjects: number
  completedProjects: number
  costAbnormalCount: number
  highRiskCount: number
  upcomingBurnout?: {
    projectName: string
    burnoutDate: string
  }
  progressDeviationCount: number
}

// 操作日志类型
export interface OperationLog {
  logId: number
  userId: number
  action: string
  details: string
  ipAddress: string
  createdAt: string
}