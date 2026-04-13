import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/common/Layout'
import Dashboard from './pages/Dashboard'
import CostEstimateUpload from './pages/CostEstimate/Upload'
import CostEstimateProjectInfo from './pages/CostEstimate/ProjectInfo'
import CostEstimateAIAnalysis from './pages/CostEstimate/AIAnalysis'
import CostEstimateConfig from './pages/CostEstimate/Config'
import CostEstimateResult from './pages/CostEstimate/Result'
import CostConsumptionInput from './pages/CostConsumption/Input'
import CostConsumptionResult from './pages/CostConsumption/Result'
import CostDeviationInput from './pages/CostDeviation/Input'
import CostDeviationResult from './pages/CostDeviation/Result'
import CostDeviationMemberList from './pages/CostDeviation/MemberList'
import ProjectList from './pages/Project/List'
import ProjectDetail from './pages/Project/Detail'
import UserSetting from './pages/User/Setting'
import Exception from './pages/Exception'

function App() {
  return (
    <Routes>
      {/* 主布局 - 无需登录验证 */}
      <Route path="/" element={<Layout />}>
        {/* 首页仪表盘 */}
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />

        {/* 实施成本预估（5步流程） */}
        <Route path="cost-estimate">
          <Route path="upload" element={<CostEstimateUpload />} />
          <Route path="project-info" element={<CostEstimateProjectInfo />} />
          <Route path="ai-analysis" element={<CostEstimateAIAnalysis />} />
          <Route path="config" element={<CostEstimateConfig />} />
          <Route path="result" element={<CostEstimateResult />} />
        </Route>

        {/* 成本消耗预估 */}
        <Route path="cost-consumption">
          <Route path="input" element={<CostConsumptionInput />} />
          <Route path="result" element={<CostConsumptionResult />} />
        </Route>

        {/* 成本偏差监控 */}
        <Route path="cost-deviation">
          <Route path="input" element={<CostDeviationInput />} />
          <Route path="result" element={<CostDeviationResult />} />
          <Route path="member-list" element={<CostDeviationMemberList />} />
        </Route>

        {/* 我的项目 */}
        <Route path="project">
          <Route path="list" element={<ProjectList />} />
          <Route path="detail/:projectId" element={<ProjectDetail />} />
        </Route>

        {/* 个人设置 */}
        <Route path="user">
          <Route path="setting" element={<UserSetting />} />
        </Route>
      </Route>

      {/* 异常页面 */}
      <Route path="/exception" element={<Exception />} />
      <Route path="*" element={<Navigate to="/exception?type=404" replace />} />
    </Routes>
  )
}

export default App