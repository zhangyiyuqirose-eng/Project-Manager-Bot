/**
 * OA截图OCR识别和自动填充脚本
 * 功能：上传OA项目截图 -> OCR识别图片文字 -> 自动提取项目信息、项目成员名单 -> 自动填充到表单
 * 使用：在浏览器控制台运行此脚本
 */

// ==================== 配置区域 ====================

// 大模型接口配置
const LLM_CONFIG = {
  URL: 'https://www.finna.com.cn/v1/chat/completions',
  MODEL: 'qwen2.5-vl-72b-instruct',
  API_KEY: 'app-7FrGiVvM1BjpWKSf9vsUF6rJ'
}

// 页面选择器配置 - 根据实际页面结构调整
const SELECTORS = {
  // 项目信息表单字段
  projectName: 'input[placeholder*="项目名称"]',
  projectCode: 'input[placeholder*="项目编号"]',
  contractAmount: 'input[placeholder*="合同金额"]',
  preSaleRatio: 'input[placeholder*="售前比例"]',
  taxRate: 'input[placeholder*="税率"]',
  externalLaborCost: 'input[placeholder*="外采人力成本"]',
  externalSoftwareCost: 'input[placeholder*="外采软件成本"]',
  otherCost: 'input[placeholder*="其他成本"]',
  currentManpowerCost: 'input[placeholder*="当前人力成本"]',
  
  // 成员相关按钮和表格
  addMemberButton: 'button:contains("新增成员")',
  memberTable: 'table',
  memberNameInput: 'input[placeholder*="姓名"]',
  memberLevelSelect: 'select',
  memberDailyCostInput: 'input[placeholder*="日成本"]',
  memberDepartmentInput: 'input[placeholder*="部门"]',
  
  // 文件上传区域
  uploadArea: '.ant-upload-drag',
  fileInput: 'input[type="file"]'
}

// ==================== 主函数 ====================

/**
 * 主函数：执行OCR识别和自动填充
 */
async function main() {
  console.log('🚀 开始OA截图OCR识别和自动填充...')
  
  try {
    // 1. 检查页面是否加载完成
    if (!checkPageReady()) {
      console.error('❌ 页面未准备好，请确保在正确的页面上')
      return
    }
    
    // 2. 选择图片文件
    const imageFile = await selectImageFile()
    if (!imageFile) {
      console.log('❌ 未选择图片文件')
      return
    }
    
    console.log('📷 已选择图片:', imageFile.name)
    
    // 3. 使用大模型进行OCR识别
    console.log('🔍 开始OCR识别...')
    const ocrResult = await recognizeWithLLM(imageFile)
    console.log('✅ OCR识别完成:', ocrResult)
    
    // 4. 自动填充项目信息
    console.log('📝 开始自动填充项目信息...')
    await fillProjectInfo(ocrResult)
    console.log('✅ 项目信息填充完成')
    
    // 5. 自动填充成员信息
    console.log('👥 开始自动填充成员信息...')
    await fillMemberInfo(ocrResult.members || [])
    console.log('✅ 成员信息填充完成')
    
    console.log('🎉 所有信息填充完成！请核对并修正数据')
    
  } catch (error) {
    console.error('❌ 执行过程中出现错误:', error)
  }
}

// ==================== 辅助函数 ====================

/**
 * 检查页面是否准备好
 */
function checkPageReady() {
  // 检查关键元素是否存在
  const uploadArea = document.querySelector(SELECTORS.uploadArea)
  const projectNameInput = document.querySelector(SELECTORS.projectName)
  
  if (!uploadArea || !projectNameInput) {
    console.warn('⚠️ 页面元素未找到，可能不在正确的页面上')
    return false
  }
  
  return true
}

/**
 * 选择图片文件
 */
async function selectImageFile() {
  return new Promise((resolve) => {
    // 创建文件选择器
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      resolve(file || null)
    }
    
    input.oncancel = () => {
      resolve(null)
    }
    
    input.click()
  })
}

/**
 * 使用大模型进行OCR识别
 */
async function recognizeWithLLM(imageFile: File) {
  try {
    // 将图片转换为base64
    const imageBase64 = await fileToBase64(imageFile)
    
    // 构建请求体
    const requestBody = {
      model: LLM_CONFIG.MODEL,
      messages: [
        {
          role: 'system',
          content: `你是一个专业的财务数据分析师。请分析用户提供的OA系统截图，提取以下财务信息：
1. 项目名称
2. 项目编号
3. 合同金额（万元）
4. 售前比例（小数，如0.15表示15%）
5. 税率（小数，如0.06表示6%）
6. 外采人力成本（万元）
7. 外采软件成本（万元）
8. 其他成本（万元）
9. 当前人力成本（万元）
10. 项目成员信息（姓名、等级、部门、工时）

请以JSON格式返回结果，格式如下：
{
  "projectName": "",
  "projectCode": "",
  "contractAmount": 0,
  "preSaleRatio": 0,
  "taxRate": 0.06,
  "externalLaborCost": 0,
  "externalSoftwareCost": 0,
  "otherCost": 0,
  "currentManpowerCost": 0,
  "members": [
    {
      "name": "",
      "level": "P5|P6|P7|P8",
      "department": "",
      "reportedHours": 0
    }
  ]
}

只返回JSON，不要返回其他内容。如果图片中无法找到某项信息，对应字段填0或空字符串。`
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: '请识别并提取图片中的项目信息和财务数据。仔细观察图片中的所有数字和文字信息。' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
          ]
        }
      ],
      temperature: 0.3,
      stream: false
    }
    
    // 调用大模型API
    const response = await fetch(LLM_CONFIG.URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_CONFIG.API_KEY}`
      },
      body: JSON.stringify(requestBody)
    })
    
    if (!response.ok) {
      throw new Error(`API调用失败: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    
    if (!content) {
      throw new Error('API返回内容为空')
    }
    
    // 解析JSON结果
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('无法从API返回中提取JSON')
    }
    
    const result = JSON.parse(jsonMatch[0])
    console.log('📊 识别结果:', result)
    
    return result
    
  } catch (error) {
    console.error('OCR识别失败:', error)
    throw error
  }
}

/**
 * 将文件转换为base64
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // 移除data:image/xxx;base64,前缀
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * 自动填充项目信息
 */
async function fillProjectInfo(ocrResult: any) {
  const fields = [
    { selector: SELECTORS.projectName, value: ocrResult.projectName || '' },
    { selector: SELECTORS.projectCode, value: ocrResult.projectCode || '' },
    { selector: SELECTORS.contractAmount, value: ocrResult.contractAmount || 0 },
    { selector: SELECTORS.preSaleRatio, value: ocrResult.preSaleRatio || 0 },
    { selector: SELECTORS.taxRate, value: ocrResult.taxRate || 0.06 },
    { selector: SELECTORS.externalLaborCost, value: ocrResult.externalLaborCost || 0 },
    { selector: SELECTORS.externalSoftwareCost, value: ocrResult.externalSoftwareCost || 0 },
    { selector: SELECTORS.otherCost, value: ocrResult.otherCost || 0 },
    { selector: SELECTORS.currentManpowerCost, value: ocrResult.currentManpowerCost || 0 }
  ]
  
  for (const field of fields) {
    const element = findInputElement(field.selector)
    if (element) {
      await setInputValue(element, field.value)
      console.log(`✅ 已填充: ${field.selector} = ${field.value}`)
    } else {
      console.warn(`⚠️ 未找到元素: ${field.selector}`)
    }
  }
}

/**
 * 自动填充成员信息
 */
async function fillMemberInfo(members: any[]) {
  if (!members || members.length === 0) {
    console.log('ℹ️ 没有成员信息需要填充')
    return
  }
  
  for (let i = 0; i < members.length; i++) {
    const member = members[i]
    
    // 如果不是第一个成员，点击新增成员按钮
    if (i > 0) {
      const addButton = findAddMemberButton()
      if (addButton) {
        addButton.click()
        await sleep(500) // 等待新行添加
      } else {
        console.warn('⚠️ 未找到新增成员按钮')
        break
      }
    }
    
    // 填充成员信息
    await fillSingleMember(member, i)
  }
}

/**
 * 填充单个成员信息
 */
async function fillSingleMember(member: any, index: number) {
  console.log(`👤 填充第 ${index + 1} 个成员:`, member)
  
  // 查找当前行的输入框
  const nameInput = findMemberInput('name', index)
  const levelSelect = findMemberInput('level', index)
  const departmentInput = findMemberInput('department', index)
  const reportedHoursInput = findMemberInput('reportedHours', index)
  
  if (nameInput) {
    await setInputValue(nameInput, member.name || '')
    console.log(`✅ 已填充姓名: ${member.name}`)
  }
  
  if (levelSelect && member.level) {
    await setSelectValue(levelSelect, member.level)
    console.log(`✅ 已填充等级: ${member.level}`)
  }
  
  if (departmentInput) {
    await setInputValue(departmentInput, member.department || '')
    console.log(`✅ 已填充部门: ${member.department}`)
  }
  
  if (reportedHoursInput) {
    await setInputValue(reportedHoursInput, member.reportedHours || 0)
    console.log(`✅ 已填充工时: ${member.reportedHours}`)
  }
}

/**
 * 查找输入框元素
 */
function findInputElement(selector: string): HTMLInputElement | null {
  // 尝试多种查找方式
  let element = document.querySelector(selector) as HTMLInputElement
  
  // 如果找不到，尝试通过placeholder查找
  if (!element) {
    const inputs = document.querySelectorAll('input')
    for (const input of inputs) {
      if (input.placeholder && selector.includes(input.placeholder)) {
        element = input as HTMLInputElement
        break
      }
    }
  }
  
  return element
}

/**
 * 查找新增成员按钮
 */
function findAddMemberButton(): HTMLButtonElement | null {
  const buttons = document.querySelectorAll('button')
  for (const button of buttons) {
    if (button.textContent?.includes('新增') || button.textContent?.includes('添加')) {
      return button as HTMLButtonElement
    }
  }
  return null
}

/**
 * 查找成员输入框
 */
function findMemberInput(field: string, index: number): HTMLInputElement | null {
  // 查找成员表格中的输入框
  const table = document.querySelector(SELECTORS.memberTable)
  if (!table) return null
  
  const rows = table.querySelectorAll('tbody tr')
  if (index >= rows.length) return null
  
  const row = rows[index]
  const inputs = row.querySelectorAll('input')
  
  // 根据字段类型查找对应的输入框
  // 这里需要根据实际表格结构进行调整
  if (field === 'name' && inputs[0]) return inputs[0] as HTMLInputElement
  if (field === 'department' && inputs[1]) return inputs[1] as HTMLInputElement
  if (field === 'reportedHours' && inputs[2]) return inputs[2] as HTMLInputElement
  
  return null
}

/**
 * 设置输入框的值
 */
async function setInputValue(element: HTMLInputElement, value: any): Promise<void> {
  // 聚焦元素
  element.focus()
  await sleep(100)
  
  // 清空当前值
  element.value = ''
  
  // 触发input事件
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
  
  await sleep(100)
  
  // 设置新值
  element.value = String(value)
  
  // 触发input和change事件
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
  
  // 失焦
  element.blur()
  await sleep(100)
}

/**
 * 设置下拉选择框的值
 */
async function setSelectValue(element: HTMLSelectElement, value: string): Promise<void> {
  element.focus()
  await sleep(100)
  
  element.value = value
  element.dispatchEvent(new Event('change', { bubbles: true }))
  
  element.blur()
  await sleep(100)
}

/**
 * 睡眠函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ==================== 执行入口 ====================

// 在控制台运行 main() 函数即可开始执行
console.log('📋 OCR自动填充脚本已加载')
console.log('💡 使用方法: 在控制台运行 main() 函数')
console.log('🔧 配置修改: 修改 LLM_CONFIG 和 SELECTORS 变量')

// 自动执行（可选）
// main()