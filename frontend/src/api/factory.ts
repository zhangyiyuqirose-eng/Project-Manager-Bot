import axios from 'axios'
import type { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios'
import { message } from 'antd'
import { useUserStore } from '../store/userStore'

/**
 * 创建 Axios 实例的工厂函数
 * 统一配置拦截器，消除重复代码
 *
 * @param timeout 超时时间（毫秒）
 * @returns 配置好的 Axios 实例
 */
export function createApiInstance(timeout: number): AxiosInstance {
  const instance = axios.create({
    baseURL: '/api',
    timeout,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  // 请求拦截器：自动附加 token
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = useUserStore.getState().token
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    },
    (error) => Promise.reject(error)
  )

  // 响应拦截器：统一处理错误
  instance.interceptors.response.use(
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
    handleApiError
  )

  return instance
}

/**
 * 统一的 API 错误处理函数
 * @param error Axios 错误对象
 */
function handleApiError(error: AxiosError): Promise<never> {
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
      const errorMessages: Record<number, string> = {
        401: '接口未授权，请检查权限',
        403: '权限不足，无法访问',
        404: '请求的资源不存在',
        500: '服务器错误，请稍后重试',
      }
      message.error(errorMessages[status] || (data as any)?.message || '请求失败')
    }
  } else if (error.request) {
    message.error('网络错误，请检查网络连接')
  } else {
    message.error(error.message || '请求失败')
  }

  return Promise.reject(error)
}

/**
 * 创建支持请求取消的 API 实例
 * 用于组件级别的请求管理
 *
 * @param timeout 超时时间（毫秒）
 * @returns Axios 实例和 AbortController 工具函数
 */
export function createApiWithAbort(timeout: number) {
  const instance = createApiInstance(timeout)

  /**
   * 创建 AbortController 并返回 signal
   */
  const createAbortController = () => {
    return new AbortController()
  }

  /**
   * 在请求配置中添加 signal
   */
  const withAbortSignal = (signal: AbortSignal) => {
    return { signal }
  }

  return {
    instance,
    createAbortController,
    withAbortSignal,
  }
}

// 默认导出工厂函数
export default createApiInstance