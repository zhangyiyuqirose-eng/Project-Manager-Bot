import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuidv4 } from 'uuid'

/**
 * 修复 multer 中文文件名乱码
 * Multer 使用 latin1 编码处理文件名，导致中文文件名乱码
 * @param filename 原始文件名
 * @returns 解码后的文件名
 */
export function decodeFilename(filename: string): string {
  try {
    const decoded = Buffer.from(filename, 'latin1').toString('utf8')
    // 检测乱码特征（Unicode 替换字符）
    if (decoded.includes('\ufffd') || decoded.includes('')) {
      return filename
    }
    return decoded
  } catch {
    return filename
  }
}

/**
 * 确保上传目录存在
 * @param dir 目录路径
 */
export function ensureUploadDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

/**
 * 生成唯一文件名
 * 使用 UUID + 原始扩展名
 * @param originalName 原始文件名
 * @returns 唯一文件名
 */
export function generateUniqueFilename(originalName: string): string {
  const decodedName = decodeFilename(originalName)
  const ext = path.extname(decodedName)
  return `${uuidv4()}${ext}`
}

/**
 * 获取文件扩展名（不含点）
 * @param filename 文件名
 * @returns 扩展名
 */
export function getFileExtension(filename: string): string {
  const ext = path.extname(filename)
  return ext ? ext.slice(1).toLowerCase() : ''
}

/**
 * 检查文件是否为允许的类型
 * @param filename 文件名
 * @param allowedExtensions 允许的扩展名列表
 * @returns 是否允许
 */
export function isAllowedFileType(
  filename: string,
  allowedExtensions: string[]
): boolean {
  const ext = getFileExtension(filename)
  return allowedExtensions.includes(ext)
}

/**
 * 格式化文件大小
 * @param bytes 字节数
 * @returns 格式化后的字符串
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}