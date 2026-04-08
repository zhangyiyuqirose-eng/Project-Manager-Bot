import { useState, useEffect, useRef } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout as AntLayout, Dropdown, Avatar, Breadcrumb, Button, Typography, Badge, Tooltip } from 'antd'
import {
  DashboardOutlined,
  CalculatorOutlined,
  BarChartOutlined,
  AlertOutlined,
  ProjectOutlined,
  UserOutlined,
  LogoutOutlined,
  HomeOutlined,
  SettingOutlined,
  BellOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import { useUserStore } from '@/store/userStore'
import type { MenuProps } from 'antd'

const { Header, Content } = AntLayout
const { Text } = Typography

// 导航配置
const navConfig = [
  {
    key: '/dashboard',
    label: '首页',
    icon: <DashboardOutlined />,
    description: '数据概览与统计'
  },
  {
    key: '/cost-estimate',
    label: '成本预估',
    icon: <CalculatorOutlined />,
    description: '实施成本智能评估',
    children: [
      { key: '/cost-estimate/upload', label: '数据上传', icon: '📤' },
      { key: '/cost-estimate/config', label: '参数配置', icon: '⚙️' },
      { key: '/cost-estimate/result', label: '预估结果', icon: '📊' },
    ],
  },
  {
    key: '/cost-consumption',
    label: '成本消耗',
    icon: <BarChartOutlined />,
    description: '成本追踪与预警',
    children: [
      { key: '/cost-consumption/input', label: '数据输入', icon: '📝' },
      { key: '/cost-consumption/result', label: '预估结果', icon: '📈' },
    ],
  },
  {
    key: '/cost-deviation',
    label: '偏差监控',
    icon: <AlertOutlined />,
    description: 'AI智能偏差分析',
    children: [
      { key: '/cost-deviation/input', label: '数据输入', icon: '🔍' },
      { key: '/cost-deviation/result', label: '偏差分析', icon: '📉' },
    ],
  },
  {
    key: '/project',
    label: '项目',
    icon: <ProjectOutlined />,
    description: '项目管理',
    children: [
      { key: '/project/list', label: '项目列表', icon: '📁' },
    ],
  },
]

// 面包屑映射
const breadcrumbMap: Record<string, string> = {
  '/dashboard': '首页',
  '/cost-estimate': '成本预估',
  '/cost-estimate/upload': '数据上传',
  '/cost-estimate/config': '参数配置',
  '/cost-estimate/result': '预估结果',
  '/cost-consumption': '成本消耗',
  '/cost-consumption/input': '数据输入',
  '/cost-consumption/result': '预估结果',
  '/cost-deviation': '偏差监控',
  '/cost-deviation/input': '数据输入',
  '/cost-deviation/result': '偏差分析',
  '/project': '项目管理',
  '/project/list': '项目列表',
  '/user': '个人设置',
  '/user/setting': '账户设置',
}

// 角色映射
const roleMap: Record<string, string> = {
  pm: '项目经理',
  supervisor: '主管',
  department_head: '部门负责人',
  finance: '财务人员',
}

function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useUserStore()
  const [activeNav, setActiveNav] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const navRef = useRef<HTMLDivElement>(null)

  // 监听滚动
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setActiveNav(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 获取当前激活的导航
  const getCurrentNavKey = () => {
    const path = location.pathname
    if (path === '/') return '/dashboard'
    for (const item of navConfig) {
      if (path.startsWith(item.key)) return item.key
    }
    return '/dashboard'
  }

  // 生成面包屑
  const generateBreadcrumb = () => {
    const path = location.pathname
    const parts = path.split('/').filter(Boolean)
    const items: { title: React.ReactNode; href?: string }[] = [
      { title: <HomeOutlined style={{ fontSize: 14 }} />, href: '/dashboard' },
    ]
    let currentPath = ''
    parts.forEach((part) => {
      currentPath += '/' + part
      const title = breadcrumbMap[currentPath]
      if (title) items.push({ title })
    })
    return items
  }

  // 用户下拉菜单
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
      onClick: () => navigate('/user/setting'),
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '系统设置',
      onClick: () => navigate('/user/setting'),
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
      onClick: () => {
        logout()
        window.location.reload()
      },
    },
  ]

  // 导航点击
  const handleNavClick = (key: string, hasChildren: boolean) => {
    if (hasChildren) {
      setActiveNav(activeNav === key ? null : key)
    } else {
      navigate(key)
      setActiveNav(null)
    }
  }

  // 子菜单点击
  const handleSubClick = (key: string) => {
    navigate(key)
    setActiveNav(null)
  }

  const currentNavKey = getCurrentNavKey()

  return (
    <AntLayout style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* 顶部导航栏 */}
      <Header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          width: '100%',
          padding: '0 24px',
          background: scrolled ? 'rgba(255, 255, 255, 0.95)' : '#fff',
          backdropFilter: scrolled ? 'blur(10px)' : 'none',
          borderBottom: '1px solid #f1f5f9',
          height: 64,
          display: 'flex',
          alignItems: 'center',
          boxShadow: scrolled ? '0 1px 3px rgba(0, 0, 0, 0.05)' : 'none',
          transition: 'all 0.2s ease',
        }}
      >
        {/* Logo区域 */}
        <div style={{ display: 'flex', alignItems: 'center', marginRight: 32 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
            }}
          >
            <CalculatorOutlined style={{ color: '#fff', fontSize: 22 }} />
          </div>
          <div>
            <Text strong style={{ fontSize: 18, color: '#0f172a', letterSpacing: '-0.02em' }}>
              数字员工
            </Text>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: -2 }}>
              成本智能管控平台
            </Text>
          </div>
        </div>

        {/* 主导航 */}
        <nav ref={navRef} style={{ display: 'flex', alignItems: 'center', flex: 1, gap: 4 }}>
          {navConfig.map((item) => {
            const isActive = currentNavKey === item.key
            const hasChildren = item.children && item.children.length > 0
            const showChildren = activeNav === item.key && hasChildren

            return (
              <div key={item.key} style={{ position: 'relative' }}>
                <Tooltip title={item.description} placement="bottom" mouseEnterDelay={0.5}>
                  <button
                    onClick={() => handleNavClick(item.key, !!hasChildren)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 16px',
                      borderRadius: 10,
                      border: 'none',
                      background: isActive ? 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)' : 'transparent',
                      color: isActive ? '#fff' : '#475569',
                      fontWeight: isActive ? 600 : 500,
                      fontSize: 14,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      height: 40,
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = '#f1f5f9'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent'
                      }
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{item.icon}</span>
                    {item.label}
                  </button>
                </Tooltip>

                {/* 子菜单下拉 */}
                {showChildren && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      left: 0,
                      minWidth: 180,
                      background: '#fff',
                      borderRadius: 16,
                      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
                      overflow: 'hidden',
                      zIndex: 1000,
                      border: '1px solid #f1f5f9',
                      animation: 'fadeIn 0.15s ease',
                    }}
                  >
                    {item.children?.map((child, index) => (
                      <div
                        key={child.key}
                        onClick={() => handleSubClick(child.key)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '14px 20px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          color: location.pathname === child.key ? '#3B82F6' : '#475569',
                          fontWeight: location.pathname === child.key ? 600 : 400,
                          background: location.pathname === child.key ? '#eff6ff' : 'transparent',
                          borderTop: index > 0 ? '1px solid #f1f5f9' : 'none',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f8fafc'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = location.pathname === child.key ? '#eff6ff' : 'transparent'
                        }}
                      >
                        <span style={{ fontSize: 16 }}>{child.icon}</span>
                        {child.label}
                        {location.pathname === child.key && (
                          <CheckCircleOutlined style={{ marginLeft: 'auto', color: '#3B82F6' }} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* 右侧工具栏 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* 通知按钮 */}
          <Tooltip title="通知中心">
            <Button
              type="text"
              icon={<Badge count={0} size="small"><BellOutlined style={{ fontSize: 18 }} /></Badge>}
              style={{ width: 40, height: 40, borderRadius: 10 }}
            />
          </Tooltip>

          {/* 用户信息 */}
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 12px 6px 8px',
                borderRadius: 12,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: '#f8fafc',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f1f5f9'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f8fafc'
              }}
            >
              <Avatar
                size={36}
                icon={<UserOutlined />}
                style={{
                  background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
                  boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Text strong style={{ fontSize: 14, lineHeight: '18px' }}>
                  {user?.name || '用户'}
                </Text>
                <Text type="secondary" style={{ fontSize: 11, lineHeight: '14px' }}>
                  {roleMap[user?.role || 'pm']}
                </Text>
              </div>
            </div>
          </Dropdown>
        </div>
      </Header>

      {/* 面包屑导航 */}
      <div
        style={{
          padding: '16px 24px 0',
          background: '#f8fafc',
        }}
      >
        <Breadcrumb items={generateBreadcrumb()} />
      </div>

      {/* 主内容区域 */}
      <Content
        style={{
          margin: 0,
          minHeight: 'calc(100vh - 64px)',
          padding: '24px',
          background: '#f8fafc',
        }}
      >
        <Outlet />
      </Content>
    </AntLayout>
  )
}

export default Layout