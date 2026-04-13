import { Steps } from 'antd'
import {
  FileTextOutlined,
  InfoCircleOutlined,
  FileSearchOutlined,
  SettingOutlined,
  BarChartOutlined,
} from '@ant-design/icons'

interface EstimateStepsProps {
  current: number
}

// 步骤条配置 - 5步流程
const ESTIMATE_STEP_ITEMS = [
  {
    title: '上传',
    description: '需求文档',
    icon: <FileTextOutlined />,
  },
  {
    title: '信息',
    description: '项目信息',
    icon: <InfoCircleOutlined />,
  },
  {
    title: '分析',
    description: 'AI解析',
    icon: <FileSearchOutlined />,
  },
  {
    title: '配置',
    description: '参数设置',
    icon: <SettingOutlined />,
  },
  {
    title: '结果',
    description: '成本预估',
    icon: <BarChartOutlined />,
  },
]

/**
 * 成本预估流程步骤条组件
 * 统一在5个页面中使用，避免重复代码
 */
export default function EstimateSteps({ current }: EstimateStepsProps) {
  return (
    <div className="steps-container">
      <Steps current={current} items={ESTIMATE_STEP_ITEMS} size="small" />
    </div>
  )
}