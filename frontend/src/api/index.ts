import type { AxiosInstance } from 'axios'
import { createApiInstance } from './factory'

// 创建axios实例（使用工厂函数，消除拦截器重复代码）
const api: AxiosInstance = createApiInstance(30000) // 默认30秒，普通API调用

// AI操作专用实例，timeout更长
const aiApi: AxiosInstance = createApiInstance(180000) // AI操作3分钟timeout

// API响应格式
export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
  meta?: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
  timestamp?: number
}

// 分页响应格式（用于列表数据）
export interface PageResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

// 认证相关API
export const authApi = {
  login: (username: string, password: string) =>
    api.post<ApiResponse<{ token: string; user: any }>>('/auth/login', { username, password }),

  logout: () =>
    api.post<ApiResponse>('/auth/logout'),

  getUserInfo: () =>
    api.get<ApiResponse<any>>('/auth/user-info'),

  changePassword: (oldPassword: string, newPassword: string) =>
    api.post<ApiResponse>('/auth/change-password', { oldPassword, newPassword }),
}

// 仪表盘相关API
export const dashboardApi = {
  getStats: () =>
    api.get<ApiResponse<any>>('/dashboard/stats'),
}

// 项目相关API
export const projectApi = {
  getList: (params?: { status?: string; keyword?: string; page?: number; pageSize?: number }) =>
    api.get<ApiResponse<any[]>>('/projects', { params }),

  getDetail: (projectId: number) =>
    api.get<ApiResponse<any>>(`/projects/${projectId}`),

  create: (data: any) =>
    api.post<ApiResponse<any>>('/projects', data),

  update: (projectId: number, data: any) =>
    api.put<ApiResponse<any>>(`/projects/${projectId}`, data),

  delete: (projectId: number) =>
    api.delete<ApiResponse>(`/projects/${projectId}`),
}

// 实施成本预估相关API
export const estimateApi = {
  uploadDocument: (file: File) => {
    const formData = new FormData()
    formData.append('document', file)
    return api.post<ApiResponse<any>>('/estimate/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  // AI解析文档，使用更长的timeout
  parseDocument: (projectId: number) =>
    aiApi.post<ApiResponse<any>>(`/estimate/${projectId}/parse`),

  // 获取文档解析结果
  getParseResult: (projectId: number) =>
    api.get<ApiResponse<any>>(`/estimate/${projectId}/parse-result`),

  // 更新解析结果（功能点编辑、项目信息）
  updateParseResult: (projectId: number, data: { modules?: any[]; projectName?: string; systemName?: string }) =>
    api.put<ApiResponse<any>>(`/estimate/${projectId}/parse-result`, data),

  getDefaultConfig: () =>
    api.get<ApiResponse<any>>('/estimate/config/default'),

  getConfig: (projectId: number) =>
    api.get<ApiResponse<any>>(`/estimate/${projectId}/config`),

  saveConfig: (projectId: number, config: any) =>
    api.post<ApiResponse<any>>(`/estimate/${projectId}/config`, config),

  // AI计算，使用更长的timeout
  calculate: (projectId: number) =>
    aiApi.post<ApiResponse<any>>(`/estimate/${projectId}/calculate`),

  getResult: (projectId: number) =>
    api.get<ApiResponse<any>>(`/estimate/${projectId}/result`),

  // 导出Excel，使用更长的timeout（AI生成描述需要时间）
  exportExcel: (projectId: number) =>
    aiApi.get(`/estimate/${projectId}/export`, { responseType: 'blob' }),
}

// 成本消耗预估相关API
export const consumptionApi = {
  uploadOcrImage: (files: File[]) => {
    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))
    return api.post<ApiResponse<any>>('/consumption/ocr', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  // 新增：根据项目编号查询项目信息
  queryByProjectCode: (projectCode: string) =>
    api.get<ApiResponse<any>>(`/consumption/project/${projectCode}`),

  // 新增：保存项目信息（支持新增和更新）
  saveProject: (data: any) =>
    api.post<ApiResponse<any>>('/consumption/save-project', data),

  saveProjectInfo: (projectId: number, data: any) =>
    api.post<ApiResponse<any>>(`/consumption/${projectId}/info`, data),

  // 新增：保存项目人员信息
  saveMembers: (projectId: number, members: any[]) =>
    api.post<ApiResponse<any>>(`/consumption/${projectId}/save-members`, { members }),

  calculateCost: (projectId: number, members?: any[]) =>
    api.post<ApiResponse<any>>(`/consumption/${projectId}/calculate`, { members }),

  adjustMembers: (projectId: number, members: any[]) =>
    api.post<ApiResponse<any>>(`/consumption/${projectId}/members`, { members }),

  getResult: (projectId: number) =>
    api.get<ApiResponse<any>>(`/consumption/${projectId}/result`),
}

// 成本偏差监控相关API
export const deviationApi = {
  // 修改：合并上传，支持多张图片
  uploadImages: (files: File[]) => {
    const formData = new FormData()
    files.forEach((file) => formData.append('images', file))
    return api.post<ApiResponse<any>>('/deviation/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  // AI识别，使用更长的timeout
  aiRecognize: (projectId: number) =>
    aiApi.post<ApiResponse<any>>(`/deviation/${projectId}/recognize`),

  saveBaseline: (projectId: number, baseline: any) =>
    api.post<ApiResponse<any>>(`/deviation/${projectId}/baseline`, baseline),

  calculateDeviation: (projectId: number) =>
    api.post<ApiResponse<any>>(`/deviation/${projectId}/calculate`),

  // AI建议，使用更长的timeout
  getAiSuggestion: (projectId: number) =>
    aiApi.get<ApiResponse<any>>(`/deviation/${projectId}/suggestion`),

  getResult: (projectId: number) =>
    api.get<ApiResponse<any>>(`/deviation/${projectId}/result`),

  exportReport: (projectId: number) =>
    api.get(`/deviation/${projectId}/export`, { responseType: 'blob' }),

  // 保存人力成本明细
  saveManpowerCost: (data: { projectCode: string; members: any[] }) =>
    api.post<ApiResponse<any>>('/deviation/save-manpower-cost', data),

  // 更新项目信息到偏差记录
  updateProjectInfo: (projectId: number, data: { totalContractAmount: number; currentCostConsumption: number; taskProgress: number }) =>
    api.put<ApiResponse<any>>(`/deviation/${projectId}/project-info`, data),
}

export default api