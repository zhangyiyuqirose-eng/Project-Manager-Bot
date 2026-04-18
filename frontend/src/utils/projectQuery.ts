import { projectApi, consumptionApi } from '@/api'

export interface ProjectQueryResult {
  success: boolean
  message: string
  projectInfo?: {
    projectId: number
    projectCode: string
    projectName: string
    projectType: string
    status: string
    contractAmount: number
    currentManpowerCost: number
    taskProgress: number
  }
  members?: Array<{
    memberId: number
    name: string
    department: string
    level: string
    dailyCost: number
    entryTime: string | null
    leaveTime: string | null
    isToEnd: boolean
  }>
}

export const queryProjectByCode = async (projectCode: string): Promise<ProjectQueryResult> => {
  try {
    if (!projectCode || projectCode.trim() === '') {
      return {
        success: false,
        message: '请输入项目编号'
      }
    }

    console.log('[ProjectQuery] 开始查询项目:', projectCode)

    // 直接通过consumptionApi.queryByProjectCode查询项目信息
    const response = await consumptionApi.queryByProjectCode(projectCode)
    if (response.data.code !== 0 && response.data.code !== 200) {
      return {
        success: false,
        message: response.data.message || '项目不存在，请补充完整信息后保存'
      }
    }

    const data = response.data.data
    if (!data) {
      return {
        success: false,
        message: '项目详细信息不存在，请补充完整信息后保存'
      }
    }

    console.log('[ProjectQuery] 查询到详细信息:', data)

    // 返回统一的数据格式
    return {
      success: true,
      message: '项目信息已加载',
      projectInfo: {
        projectId: data.projectId,
        projectCode: data.projectCode,
        projectName: data.projectName || '',
        projectType: data.projectType || 'implementation',
        status: data.status || 'ongoing',
        contractAmount: data.contractAmount || 0,
        currentManpowerCost: data.currentManpowerCost || 0,
        taskProgress: 0
      },
      members: data.members && Array.isArray(data.members) ? data.members.map((member: any) => ({
        memberId: member.memberId,
        name: member.name || '',
        department: member.department || '',
        level: member.level || 'P5',
        dailyCost: member.dailyCost || 0.16,
        role: member.role || '',
        entryTime: member.entryTime || null,
        leaveTime: member.leaveTime || null,
        isToEnd: member.isToEnd || false,
        reportedHours: member.reportedHours || 0
      })) : []
    }
  } catch (error: any) {
    console.error('[ProjectQuery] 查询项目失败:', error)
    return {
      success: false,
      message: error?.response?.data?.message || '查询项目失败，请稍后重试'
    }
  }
}