import dayjs from 'dayjs'

/**
 * 格式化金额
 * @param amount 金额数值
 * @param unit 单位：'yuan' | 'wan' | 'auto'
 * @returns 格式化后的字符串
 */
export function formatMoney(amount: number, unit: 'yuan' | 'wan' | 'auto' = 'auto'): string {
  if (amount === null || amount === undefined) return '-'

  let value = amount
  let suffix = '元'

  if (unit === 'wan' || (unit === 'auto' && amount >= 10000)) {
    value = amount / 10000
    suffix = '万元'
  }

  return `${value.toFixed(2)}${suffix}`
}

/**
 * 格式化日期
 * @param date 日期
 * @param format 格式，默认 YYYY/MM/DD
 * @returns 格式化后的字符串
 */
export function formatDate(date: string | Date | null | undefined, format = 'YYYY/MM/DD'): string {
  if (!date) return '-'
  return dayjs(date).format(format)
}

/**
 * 格式化百分比
 * @param value 百分比数值（0-100）
 * @param decimals 小数位数
 * @returns 格式化后的字符串
 */
export function formatPercent(value: number, decimals = 1): string {
  if (value === null || value === undefined) return '-'
  return `${value.toFixed(decimals)}%`
}

/**
 * 格式化人天
 * @param days 人天数
 * @returns 格式化后的字符串
 */
export function formatManDay(days: number): string {
  if (days === null || days === undefined) return '-'
  return `${days}人天`
}

/**
 * 格式化人月
 * @param days 人天数
 * @returns 格式化后的字符串
 */
export function formatManMonth(days: number): string {
  if (days === null || days === undefined) return '-'
  const months = days / 21.75
  return `${months.toFixed(1)}人月`
}

/**
 * 计算工作日数（剔除周末）
 * @param startDate 开始日期
 * @param endDate 结束日期
 * @returns 工作日数
 */
export function calculateWorkdays(startDate: Date, endDate: Date): number {
  let count = 0
  const current = new Date(startDate)

  while (current <= endDate) {
    const dayOfWeek = current.getDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++
    }
    current.setDate(current.getDate() + 1)
  }

  return count
}

/**
 * 根据工作日数计算燃尽日期
 * @param startDate 开始日期
 * @param workdays 工作日数
 * @returns 燃尽日期
 */
export function calculateBurnoutDate(startDate: Date, workdays: number): Date {
  let count = 0
  const current = new Date(startDate)

  while (count < workdays) {
    current.setDate(current.getDate() + 1)
    const dayOfWeek = current.getDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++
    }
  }

  return current
}

/**
 * 人天取整（最小0.5）
 * @param days 人天数
 * @returns 取整后的人天数
 */
export function roundManDay(days: number): number {
  if (days < 0.5) return 0.5
  return Math.round(days * 2) / 2
}

/**
 * 检查权限
 * @param userPermissions 用户权限列表
 * @param requiredPermission 需要的权限
 * @returns 是否有权限
 */
export function hasPermission(userPermissions: string[], requiredPermission: string): boolean {
  return userPermissions.includes(requiredPermission) || userPermissions.includes('*')
}

/**
 * 检查角色权限
 * @param userRole 用户角色
 * @param allowedRoles 允许的角色列表
 * @returns 是否有权限
 */
export function hasRolePermission(
  userRole: string,
  allowedRoles: string[]
): boolean {
  return allowedRoles.includes(userRole)
}

/**
 * 生成唯一ID
 * @returns 唯一ID字符串
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 深拷贝对象
 * @param obj 原对象
 * @returns 拷贝后的对象
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

/**
 * 防抖函数
 * @param fn 原函数
 * @param delay 延迟时间
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null

  return function (this: any, ...args: Parameters<T>) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay)
  }
}

/**
 * 节流函数
 * @param fn 原函数
 * @param delay 间隔时间
 * @returns 节流后的函数
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastTime = 0

  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now()
    if (now - lastTime >= delay) {
      lastTime = now
      fn.apply(this, args)
    }
  }
}

/**
 * 下载文件
 * @param blob 文件Blob
 * @param filename 文件名
 */
export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * 文件大小格式化
 * @param bytes 字节数
 * @returns 格式化后的字符串
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}