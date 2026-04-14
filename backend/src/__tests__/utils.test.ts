import { describe, it, expect, vi } from 'vitest'
import { sendSuccess, sendError, sendPaginated } from '../utils/response'

// Mock Express Response
const mockResponse = () => {
  const res: any = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

describe('Response Utils', () => {
  describe('sendSuccess', () => {
    it('should send success response with default message', () => {
      const res = mockResponse()
      const data = { id: 1, name: 'test' }

      sendSuccess(res, data)

      expect(res.json).toHaveBeenCalledWith({
        code: 200,
        message: '操作成功',
        data,
      })
    })

    it('should send success response with custom message', () => {
      const res = mockResponse()
      const data = { id: 1 }

      sendSuccess(res, data, '创建成功')

      expect(res.json).toHaveBeenCalledWith({
        code: 200,
        message: '创建成功',
        data,
      })
    })
  })

  describe('sendError', () => {
    it('should send error response with status code', () => {
      const res = mockResponse()

      sendError(res, 404, '资源不存在')

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({
        code: 404,
        message: '资源不存在',
        data: null,
      })
    })

    it('should send server error response', () => {
      const res = mockResponse()

      sendError(res, 500, '服务器内部错误')

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        code: 500,
        message: '服务器内部错误',
        data: null,
      })
    })
  })

  describe('sendPaginated', () => {
    it('should send paginated response', () => {
      const res = mockResponse()
      const items = [{ id: 1 }, { id: 2 }]
      const total = 100
      const page = 1
      const pageSize = 10

      sendPaginated(res, items, total, page, pageSize)

      expect(res.json).toHaveBeenCalledWith({
        code: 0,
        message: '查询成功',
        data: { items },
        meta: {
          total: 100,
          page: 1,
          pageSize: 10,
          totalPages: 10,
        },
      })
    })
  })
})