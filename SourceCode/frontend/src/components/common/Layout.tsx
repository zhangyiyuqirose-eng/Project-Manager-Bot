import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout as AntLayout, Menu, Dropdown, Avatar, Breadcrumb, Button, theme } from 'antd'
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DashboardOutlined,
  CalculatorOutlined,
  BarChartOutlined,
  AlertOutlined,
  ProjectOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  HomeOutlined,
} from '@ant-design/icons'
import { useUserStore } from '@/store/userStore'
import type { MenuProps } from 'antd'

const { Header, Sider, Content } = AntLayout

// 菜单配置
const menuItems: MenuProps['items'] = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: '首页仪表盘',
  },
  {
    key: '/cost-estimate',
    icon: <CalculatorOutlined />,
    label: '实施成本预估',
    children: [
      { key: '/cost-estimate/upload', label: '数据上传' },
      { key: '/cost-estimate/config', label: '参数配置' },
      { key: '/cost-estimate/result', label: '预估结果' },
    ],
  },
  {
    key: '/cost-consumption',
    icon: <BarChartOutlined />,
    label: '成本消耗预估',
    children: [
      { key: '/cost-consumption/input', label: '数据输入' },
      { key: '/cost-consumption/result', label: '预估结果' },
    ],
  },
  {
    key: '/cost-deviation',
    icon: <AlertOutlined />,
    label: '成本偏差监控',
    children: [
      { key: '/cost-deviation/input', label: '数据输入' },
      { key: '/cost-deviation/result', label: '偏差分析' },
    ],
  },
  {
    key: '/project',
    icon: <ProjectOutlined />,
    label: '我的项目',
    children: [
      { key: '/project/list', label: '项目列表' },
    ],
  },
  {
    key: '/user',
    icon: <SettingOutlined />,
    label: '个人设置',
    children: [
      { key: '/user/setting', label: '账户设置' },
    ],
  },
]

// 面包屑映射
const breadcrumbMap: Record<string, string> = {
  '/dashboard': '首页仪表盘',
  '/cost-estimate': '实施成本预估',
  '/cost-estimate/upload': '数据上传',
  '/cost-estimate/config': '参数配置',
  '/cost-estimate/result': '预估结果',
  '/cost-consumption': '成本消耗预估',
  '/cost-consumption/input': '数据输入',
  '/cost-consumption/result': '预估结果',
  '/cost-deviation': '成本偏差监控',
  '/cost-deviation/input': '数据输入',
  '/cost-deviation/result': '偏差分析',
  '/project': '我的项目',
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
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { token } = theme.useToken()
  const { user, logout } = useUserStore()

  // 获取当前选中的菜单项
  const getSelectedKey = () => {
    const path = location.pathname
    // 如果是根路径，选中仪表盘
    if (path === '/') return ['/dashboard']
    return [path]
  }

  // 获取当前展开的菜单
  const getOpenKeys = () => {
    const path = location.pathname
    const parts = path.split('/').filter(Boolean)
    if (parts.length > 1) {
      return ['/' + parts[0]]
    }
    return []
  }

  // 生成面包屑
  const generateBreadcrumb = () => {
    const path = location.pathname
    const parts = path.split('/').filter(Boolean)

    const items: { title: React.ReactNode; href?: string }[] = [
      { title: <HomeOutlined />, href: '/dashboard' },
    ]

    let currentPath = ''
    parts.forEach((part) => {
      currentPath += '/' + part
      const title = breadcrumbMap[currentPath]
      if (title) {
        items.push({ title })
      }
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
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: () => {
        logout()
        // 刷新页面重置状态
        window.location.reload()
      },
    },
  ]

  // 菜单点击处理
  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key)
  }

  return (
    <AntLayout style={{ height: '100vh' }}>
      {/* 左侧菜单栏 */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={220}
        collapsedWidth={80}
        style={{
          background: '#fff',
          borderRight: `1px solid ${token.colorBorder}`,
        }}
      >
        {/* Logo区域 */}
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? 0 : '0 24px',
            borderBottom: `1px solid ${token.colorBorder}`,
          }}
        >
          {collapsed ? (
            <span style={{ fontSize: 20, fontWeight: 'bold', color: token.colorPrimary }}>
              数
            </span>
          ) : (
            <span style={{ fontSize: 18, fontWeight: 'bold', color: token.colorPrimary }}>
              数字员工系统
            </span>
          )}
        </div>

        {/* 菜单 */}
        <Menu
          mode="inline"
          selectedKeys={getSelectedKey()}
          defaultOpenKeys={getOpenKeys()}
          items={menuItems}
          onClick={handleMenuClick}
          style={{
            borderRight: 0,
            paddingTop: 8,
          }}
        />
      </Sider>

      <AntLayout>
        {/* 顶部导航栏 */}
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${token.colorBorder}`,
            height: 64,
          }}
        >
          {/* 左侧：折叠按钮 + 面包屑 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{
                fontSize: 18,
              }}
            />
            <Breadcrumb items={generateBreadcrumb()} />
          </div>

          {/* 右侧：用户信息 */}
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                padding: '8 12',
                borderRadius: 8,
                transition: 'background 0.3s',
              }}
            >
              <Avatar
                size={32}
                icon={<UserOutlined />}
                style={{ backgroundColor: token.colorPrimary }}
              />
              <div style={{ display: collapsed ? 'none' : 'block' }}>
                <span style={{ fontWeight: 500 }}>{user?.name || '用户'}</span>
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 12,
                    color: token.colorTextSecondary,
                  }}
                >
                  {roleMap[user?.role || 'pm']}
                </span>
              </div>
            </div>
          </Dropdown>
        </Header>

        {/* 主内容区域 */}
        <Content
          style={{
            margin: 0,
            minHeight: 280,
            background: '#F7F8FA',
            overflow: 'auto',
          }}
        >
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  )
}

export default Layout