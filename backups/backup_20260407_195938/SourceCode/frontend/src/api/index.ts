import axios from 'axios'
import type { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios'
import { message } from 'antd'
import { useUserStore } from '../store/userStore'

// 创建axios实例
const api: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000, // 默认30秒，普通API调用
  headers: {
    'Content-Type': 'application/json',
  },
})

// AI操作专用实例，timeout更长
const aiApi: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 180000, // AI操作3分钟timeout
  headers: {
    'Content-Type': 'application/json',
  },
})

// 为aiApi添加相同的拦截器
aiApi.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useUserStore.getState().token
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

aiApi.interceptors.response.use(
  (response) => {
    // 如果是 blob 类型响应（如文件下载），直接返回
    if (response.config.responseType === 'blob') {
      return response
    }

    const { data } = response
    if (data.code !== 0 && data.code !== 200) {
      message.error(data.message || '请求失败')
      return Promise.reject(new Error(data.message || '请求失败'))
    }
    return response
  },
  (error: AxiosError) => {
    if (error.response) {
      const { status, data } = error.response

      // 如果是 blob 响应错误，尝试解析错误信息
      if (data instanceof Blob) {
        data.text().then(text => {
          try {
            const errorData = JSON.parse(text)
            message.error(errorData.message || '请求失败')
          } catch {
            message.error('请求失败')
          }
        })
      } else {
        switch (status) {
          case 401:
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
      }
    } else if (error.request) {
      message.error('网络错误，请检查网络连接')
    } else {
      message.error(error.message || '请求失败')
    }
    return Promise.reject(error)
  }
)

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
    // 如果是 blob 类型响应（如文件下载），直接返回
    if (response.config.responseType === 'blob') {
      return response
    }

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

      // 如果是 blob 响应错误，尝试解析错误信息
      if (data instanceof Blob) {
        data.text().then(text => {
          try {
            const errorData = JSON.parse(text)
            message.error(errorData.message || '请求失败')
          } catch {
            message.error('请求失败')
          }
        })
      } else {
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

  // 更新解析结果（功能点编辑）
  updateParseResult: (projectId: number, data: { modules: any[] }) =>
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
}

export default api