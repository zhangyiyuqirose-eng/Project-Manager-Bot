import axios from 'axios'
import type { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios'
import { message } from 'antd'
import { useUserStore } from '../store/userStore'

// 创建axios实例
const api: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器：自动附加token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useUserStore.getState().token
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 响应拦截器：处理错误
api.interceptors.response.use(
  (response) => {
    const { data } = response
    // 业务逻辑错误
    if (data.code !== 0 && data.code !== 200) {
      message.error(data.message || '请求失败')
      return Promise.reject(new Error(data.message || '请求失败'))
    }
    return response
  },
  (error: AxiosError) => {
    if (error.response) {
      const { status, data } = error.response

      switch (status) {
        case 401:
          // 未授权，仅显示提示，不跳转登录页
          message.error('接口未授权，请检查权限')
          break
        case 403:
          message.error('权限不足，无法访问')
          break
        case 404:
          message.error('请求的资源不存在')
          break
        case 500:
          message.error('服务器错误，请稍后重试')
          break
        default:
          message.error((data as any)?.message || '请求失败')
      }
    } else if (error.request) {
      message.error('网络错误，请检查网络连接')
    } else {
      message.error(error.message || '请求失败')
    }

    return Promise.reject(error)
  }
)

// API响应格式
export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
  timestamp?: number
}

// 分页响应格式
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
    api.get<ApiResponse<PageResponse<any>>>('/projects', { params }),

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
    formData.append('file', file)
    return api.post<ApiResponse<any>>('/estimate/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  parseDocument: (projectId: number) =>
    api.post<ApiResponse<any>>(`/estimate/${projectId}/parse`),

  getDefaultConfig: () =>
    api.get<ApiResponse<any>>('/estimate/config/default'),

  saveConfig: (projectId: number, config: any) =>
    api.post<ApiResponse<any>>(`/estimate/${projectId}/config`, config),

  calculate: (projectId: number) =>
    api.post<ApiResponse<any>>(`/estimate/${projectId}/calculate`),

  getResult: (projectId: number) =>
    api.get<ApiResponse<any>>(`/estimate/${projectId}/result`),

  exportExcel: (projectId: number) =>
    api.get(`/estimate/${projectId}/export`, { responseType: 'blob' }),
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

  saveProjectInfo: (projectId: number, data: any) =>
    api.post<ApiResponse<any>>(`/consumption/${projectId}/info`, data),

  calculateCost: (projectId: number) =>
    api.post<ApiResponse<any>>(`/consumption/${projectId}/calculate`),

  adjustMembers: (projectId: number, members: any[]) =>
    api.post<ApiResponse<any>>(`/consumption/${projectId}/members`, { members }),

  getResult: (projectId: number) =>
    api.get<ApiResponse<any>>(`/consumption/${projectId}/result`),
}

// 成本偏差监控相关API
export const deviationApi = {
  uploadImages: (files: File[], type: string) => {
    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))
    formData.append('type', type)
    return api.post<ApiResponse<any>>('/deviation/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  aiRecognize: (projectId: number) =>
    api.post<ApiResponse<any>>(`/deviation/${projectId}/recognize`),

  saveBaseline: (projectId: number, baseline: any) =>
    api.post<ApiResponse<any>>(`/deviation/${projectId}/baseline`, baseline),

  calculateDeviation: (projectId: number) =>
    api.post<ApiResponse<any>>(`/deviation/${projectId}/calculate`),

  getAiSuggestion: (projectId: number) =>
    api.get<ApiResponse<any>>(`/deviation/${projectId}/suggestion`),

  getResult: (projectId: number) =>
    api.get<ApiResponse<any>>(`/deviation/${projectId}/result`),

  exportReport: (projectId: number) =>
    api.get(`/deviation/${projectId}/export`, { responseType: 'blob' }),
}

export default api