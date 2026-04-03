import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Result } from 'antd'
import {
  StopOutlined,
  FileSearchOutlined,
  WarningOutlined,
} from '@ant-design/icons'

type ExceptionType = '403' | '404' | '500'

interface ExceptionConfig {
  status: '403' | '404' | '500'
  title: string
  subTitle: string
  icon: React.ReactNode
}

const exceptionConfigs: Record<ExceptionType, ExceptionConfig> = {
  '403': {
    status: '403',
    title: '无访问权限',
    subTitle: '抱歉，您没有权限访问此页面，请联系管理员获取权限',
    icon: <StopOutlined style={{ fontSize: 72, color: '#ff4d4f' }} />,
  },
  '404': {
    status: '404',
    title: '页面不存在',
    subTitle: '抱歉，您访问的页面不存在或已被移除',
    icon: <FileSearchOutlined style={{ fontSize: 72, color: '#1890ff' }} />,
  },
  '500': {
    status: '500',
    title: '服务器错误',
    subTitle: '抱歉，服务器出了点问题，请稍后再试',
    icon: <WarningOutlined style={{ fontSize: 72, color: '#faad14' }} />,
  },
}

export default function Exception() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const typeParam = searchParams.get('type') as ExceptionType | null

  const type: ExceptionType = typeParam && exceptionConfigs[typeParam] ? typeParam : '404'
  const config = exceptionConfigs[type]

  const handleBackHome = () => {
    navigate('/', { replace: true })
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f0f2f5',
      }}
    >
      <Result
        icon={config.icon}
        status={config.status}
        title={config.title}
        subTitle={config.subTitle}
        extra={
          <Button type="primary" size="large" onClick={handleBackHome}>
            返回首页
          </Button>
        }
      />
    </div>
  )
}