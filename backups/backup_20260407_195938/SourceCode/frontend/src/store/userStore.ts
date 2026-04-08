import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 用户信息类型
interface User {
  userId: number
  username: string
  name: string
  role: 'pm' | 'supervisor' | 'department_head' | 'finance'
  permissions: string[]
}

// 用户状态
interface UserState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  loginTime: number | null

  // Actions
  setUser: (user: User) => void
  setToken: (token: string) => void
  login: (user: User, token: string) => void
  logout: () => void
  checkAuth: () => boolean
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      // 默认已登录状态，无需登录
      user: {
        userId: 1,
        username: 'admin',
        name: '管理员',
        role: 'pm',
        permissions: ['*'],
      },
      token: 'default-token',
      isAuthenticated: true,
      loginTime: Date.now(),

      setUser: (user) => set({ user }),

      setToken: (token) => set({ token }),

      login: (user, token) => set({
        user,
        token,
        isAuthenticated: true,
        loginTime: Date.now(),
      }),

      logout: () => set({
        user: null,
        token: null,
        isAuthenticated: false,
        loginTime: null,
      }),

      checkAuth: () => {
        // 始终返回 true，跳过认证检查
        return true
      },
    }),
    {
      name: 'user-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        loginTime: state.loginTime,
      }),
    }
  )
)

// 项目状态
interface Project {
  projectId: number
  projectName: string
  status: 'ongoing' | 'completed' | 'paused'
  createdAt: string
  updatedAt: string
}

interface ProjectState {
  currentProject: Project | null
  projects: Project[]
  setCurrentProject: (project: Project | null) => void
  setProjects: (projects: Project[]) => void
  addProject: (project: Project) => void
  updateProject: (project: Project) => void
  removeProject: (projectId: number) => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  currentProject: null,
  projects: [],

  setCurrentProject: (project) => set({ currentProject: project }),

  setProjects: (projects) => set({ projects }),

  addProject: (project) => set((state) => ({
    projects: [...state.projects, project]
  })),

  updateProject: (project) => set((state) => ({
    projects: state.projects.map((p) =>
      p.projectId === project.projectId ? project : p
    ),
    currentProject: state.currentProject?.projectId === project.projectId
      ? project
      : state.currentProject,
  })),

  removeProject: (projectId) => set((state) => ({
    projects: state.projects.filter((p) => p.projectId !== projectId),
    currentProject: state.currentProject?.projectId === projectId
      ? null
      : state.currentProject,
  })),
}))

// 全局加载状态
interface GlobalState {
  loading: boolean
  loadingText: string
  setLoading: (loading: boolean, text?: string) => void
}

export const useGlobalStore = create<GlobalState>((set) => ({
  loading: false,
  loadingText: '加载中...',

  setLoading: (loading, text = '加载中...') => set({
    loading,
    loadingText: text,
  }),
}))