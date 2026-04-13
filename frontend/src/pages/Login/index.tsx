import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Card, message, Typography } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { authApi } from '@/api'
import { useUserStore } from '@/store/userStore'
import type { AxiosError } from 'axios'

const { Title, Text } = Typography

interface LoginForm {
  username: string
  password: string
}

interface LoginResponse {
  token: string
  user: {
    userId: number
    username: string
    name: string
    role: 'pm' | 'supervisor' | 'department_head' | 'finance'
    permissions: string[]
  }
}

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const navigate = useNavigate()
  const login = useUserStore((state) => state.login)

  const handleSubmit = async (values: LoginForm) => {
    setLoading(true)
    setErrorMsg(null)

    try {
      const response = await authApi.login(values.username, values.password)
      const { token, user } = response.data.data as LoginResponse

      login(user, token)
      message.success('登录成功')
      navigate('/dashboard', { replace: true })
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string; code?: number }>
      const responseData = axiosError.response?.data

      if (axiosError.response?.status === 401) {
        if (responseData?.code === 40001) {
          setErrorMsg('账号或密码错误')
        } else if (responseData?.code === 40002) {
          setErrorMsg('账号已被锁定，请联系管理员')
        } else {
          setErrorMsg('登录失败，请检查账号密码')
        }
      } else {
        setErrorMsg(responseData?.message || '登录失败，请稍后重试')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card
        style={{
          width: 440,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          borderRadius: 24,
          border: 'none',
        }}
        styles={{
          body: { padding: '48px 40px' }
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <Title level={3} style={{ margin: 0, fontWeight: 700 }}>
            IT项目智能成本管控平台
          </Title>
          <Text type="secondary" style={{ fontSize: 14, marginTop: 8, display: 'block' }}>
            请登录您的账号
          </Text>
        </div>
        <Form
          name="login"
          onFinish={handleSubmit}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
              autoComplete="username"
              style={{ borderRadius: 12, height: 48 }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              autoComplete="current-password"
              style={{ borderRadius: 12, height: 48 }}
            />
          </Form.Item>

          {errorMsg && (
            <div
              style={{
                color: '#ff4d4f',
                textAlign: 'center',
                marginBottom: 20,
                padding: '12px 16px',
                background: '#fff2f0',
                border: '1px solid #ffccc7',
                borderRadius: 12,
                fontSize: 14,
              }}
            >
              {errorMsg}
            </div>
          )}

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{
                borderRadius: 12,
                height: 48,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                fontWeight: 600,
                fontSize: 15,
              }}
            >
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}