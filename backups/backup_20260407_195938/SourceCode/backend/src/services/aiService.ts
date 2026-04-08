import axios from 'axios'

/**
 * AI大模型服务 - OpenAI 格式 API
 * 参考 workload_assessment/server.py 的实现
 * URL: https://www.finna.com.cn/v1/chat/completions
 * Model: Qwen/Qwen3-Omni-30B-A3B-Thinking
 */

interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface AIResponse {
  id: string
  model: string
  choices: {
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }[]
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

interface DocumentParseResult {
  project_name: string
  system_name: string
  modules: {
    name: string
    description?: string
    functions: {
      name: string
      complexity: 'very_basic' | 'basic' | 'medium' | 'complex' | 'very_complex'
      association_systems: number
    }[]
    association_systems?: number
  }[]
  tech_stack?: string
  association_systems?: number
}

interface OCRResult {
  contractAmount: number
  preSaleRatio: number
  taxRate: number
  externalLaborCost: number
  externalSoftwareCost: number
  currentManpowerCost: number
  members?: {
    name: string
    level: string
    role: string
    reportedHours: number
  }[]
}

interface DeviationAnalysisResult {
  projectName: string
  contractAmount: number
  currentManpowerCost: number
  taskProgress: number
  members: {
    name: string
    level: string
    role: string
    reportedHours: number
  }[]
  suggestion: string
}

class AIService {
  private apiUrl: string
  private apiKey: string
  private model: string

  constructor() {
    // 使用新的配置
    this.apiUrl = process.env.AI_API_URL || 'https://www.finna.com.cn/v1/chat/completions'
    this.apiKey = process.env.AI_API_KEY || 'app-PvoiFWuSXcN4kwCBuplgOnnC'
    this.model = process.env.AI_MODEL || 'qwq-32b'
    console.log(`[AI Service] 初始化完成，API: ${this.apiUrl}, 模型: ${this.model}`)
  }

  /**
   * 调用AI模型（OpenAI 格式，支持流式模式）
   */
  private async chat(messages: AIMessage[], systemPrompt?: string): Promise<string> {
    try {
      // 构建消息列表，system 消息放在最前面
      const fullMessages: AIMessage[] = []
      if (systemPrompt) {
        fullMessages.push({ role: 'system', content: systemPrompt })
      }
      fullMessages.push(...messages)

      const requestBody = {
        model: this.model,
        temperature: 0.7,
        stream: true, // 启用流式模式
        messages: fullMessages
      }

      const response = await axios.post(
        this.apiUrl,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json; charset=utf-8'
          },
          responseType: 'stream',
          timeout: 180000 // 3分钟超时
        }
      )

      // 收集流式响应
      return new Promise((resolve, reject) => {
        let fullContent = ''

        response.data.on('data', (chunk: Buffer) => {
          const lines = chunk.toString().split('\n').filter(line => line.trim() !== '')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') continue
              try {
                const parsed = JSON.parse(data)
                const delta = parsed.choices?.[0]?.delta
                // 同时处理 content 和 reasoning_content 字段
                if (delta?.content) {
                  fullContent += delta.content
                }
                // reasoning_content 是推理过程，也可以收集（可选）
                // if (delta?.reasoning_content) {
                //   fullContent += delta.reasoning_content
                // }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        })

        response.data.on('end', () => {
          console.log(`[AI Service] 流式响应完成，内容长度: ${fullContent.length}`)
          if (fullContent) {
            resolve(fullContent)
          } else {
            reject(new Error('AI接口返回内容为空'))
          }
        })

        response.data.on('error', (err: Error) => {
          console.error('[AI Service] 流式响应错误:', err)
          reject(new Error('AI服务流式调用失败: ' + err.message))
        })
      })
    } catch (error: any) {
      console.error('[AI Service] 调用错误:', error?.response?.data || error?.message)
      throw new Error('AI服务调用失败: ' + (error?.response?.data?.error?.message || error?.message || '未知错误'))
    }
  }

  /**
   * 解析需求文档
   * 模型只判断需求难易程度（五档复杂度），不计算工作量。工作量由代码根据系数计算。
   */
  async parseDocument(documentText: string): Promise<DocumentParseResult> {
    const prompt = `分析以下用户需求说明书，完成两项任务：

一、提取结构
1. 明确区分"模块(module)"与"功能点(function)"：
   - 模块：对若干相关业务功能的归类和分组，如"统一 AI 工作台""用户与权限管理"等。
   - 功能点：可独立开发和交付的最小业务能力单元，如"统一入口首页布局设计""登录鉴权与单点登录集成"等。
2. 文档中以「X.X.X.X 业务功能：XXX」或类似格式标注的，每一条视为一个独立功能点。
3. 先梳理出 3~15 个功能模块(module)，再将每个功能点(function)归入最合适的模块。若文档无显式模块名，可根据业务含义命名。
4. 从文档中提取项目名称和系统名称（如有）。

二、仅判断每个功能点的难易程度（五档复杂度）
请结合功能实现难度、业务规则复杂性、跨系统协同复杂度、异常分支/边界场景、数据处理与技术实现复杂度进行综合判断。
不要使用"按操作步骤数"作为判定规则。
每个功能点只输出以下五种之一：
   - very_basic（较为基础）
   - basic（基础）
   - medium（中等）
   - complex（复杂）
   - very_complex（极复杂）

三、为每个功能点给出"系统关联数量"建议（用于计算关联度系数）
结合需求描述判断该功能需要对接/依赖的外部系统数量（如：单点登录、主数据、财务、工单、消息、权限、流程等），只输出以下四档之一：
   - 1：仅本系统或只对接 1 个外部系统
   - 3：对接 2-5 个外部系统
   - 6：对接 5+ 个外部系统（用 6 表示）
若无法判断，默认输出 1。

不要计算任何系数或工作量，只输出模块、功能列表及每个功能的 complexity 和 association_systems。

请严格以 JSON 格式返回（不要包含任何其他说明文字，只返回 JSON）：
{
  "project_name": "项目名称（未找到则空字符串）",
  "system_name": "系统名称（未找到则空字符串）",
  "modules": [
    {
      "name": "模块名称",
      "functions": [
        {"name": "功能名称", "complexity": "very_basic|basic|medium|complex|very_complex", "association_systems": 1}
      ]
    }
  ]
}


需求文档内容（限前12000字）：
${documentText.substring(0, 12000)}`

    const systemPrompt = '你是一个专业的软件项目工作量评估专家，请只返回JSON格式结果，不要返回任何markdown标记或额外说明。'

    console.log(`[AI Service] 开始解析文档，长度: ${documentText.length}`)

    const text = await this.chat(
      [{ role: 'user', content: prompt }],
      systemPrompt
    )

    if (!text) {
      throw new Error('AI模型返回为空')
    }

    console.log(`[AI Service] AI 返回长度: ${text.length}`)

    // 解析 JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[AI Service] JSON 解析失败:', text.substring(0, 200))
      throw new Error('AI返回无法解析为JSON')
    }

    let result: DocumentParseResult
    try {
      result = JSON.parse(jsonMatch[0])
    } catch (e) {
      console.error('[AI Service] JSON 解析失败:', jsonMatch[0].substring(0, 200))
      throw new Error('AI返回无法解析为JSON')
    }

    // 补充默认值
    result.project_name = result.project_name || ''
    result.system_name = result.system_name || ''
    result.tech_stack = result.tech_stack || '微服务架构'
    result.association_systems = result.association_systems || 1
    result.modules = result.modules || []

    // 补齐每个功能点的 association_systems
    for (const module of result.modules) {
      module.association_systems = module.association_systems || result.association_systems || 1
      for (const func of module.functions || []) {
        if (!func.association_systems) {
          func.association_systems = module.association_systems || 1
        }
        func.association_systems = Math.min(6, Math.max(1, Number(func.association_systems) || 1))
      }
    }

    console.log(`[AI Service] 解析成功，模块数: ${result.modules.length}`)

    return result
  }

  /**
   * OCR识别OA截图（使用 OpenAI 多模态格式）
   */
  async recognizeOCR(imageBase64: string): Promise<OCRResult> {
    const systemPrompt = `你是一个专业的财务数据分析师。请分析用户提供的OA系统截图，提取以下财务信息：
1. 合同金额（万元）
2. 售前比例（小数，如0.15表示15%）
3. 税率（小数，如0.06表示6%）
4. 外采人力成本（万元）
5. 外采软件成本（万元）
6. 当前人力成本（万元）
7. 项目成员信息（如果可见）

请以JSON格式返回结果，格式如下：
{
  "contractAmount": 0,
  "preSaleRatio": 0,
  "taxRate": 0.06,
  "externalLaborCost": 0,
  "externalSoftwareCost": 0,
  "currentManpowerCost": 0,
  "members": [{"name": "", "level": "P5|P6|P7|P8", "role": "", "reportedHours": 0}]
}`

    try {
      const response = await axios.post<AIResponse>(
        this.apiUrl,
        {
          model: this.model,
          temperature: 0.7,
          stream: false,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: '请识别并提取图片中的财务数据。' },
                { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } }
              ]
            }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json; charset=utf-8'
          },
          timeout: 60000
        }
      )

      if (response.data.choices && response.data.choices.length > 0) {
        const text = response.data.choices[0].message.content
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0])
        }
      }
    } catch (error) {
      console.error('[AI Service] OCR 识别错误:', error)
    }

    return {
      contractAmount: 0,
      preSaleRatio: 0,
      taxRate: 0.06,
      externalLaborCost: 0,
      externalSoftwareCost: 0,
      currentManpowerCost: 0
    }
  }

  /**
   * 分析项目偏差并生成建议
   */
  async analyzeDeviation(data: {
    projectName: string
    contractAmount: number
    currentCost: number
    taskProgress: number
    stageCosts: { stage: string; expected: number; actual: number }[]
    teamCosts: { team: string; expected: number; actual: number }[]
  }): Promise<string> {
    const systemPrompt = `你是一个经验丰富的IT项目管理专家。请分析项目的成本偏差情况，并给出专业的调整建议。
关注以下几点：
1. 成本偏差的原因分析
2. 各阶段成本控制的建议
3. 团队人力调整建议
4. 风险预警和应对措施

请用专业但易懂的语言给出建议，控制在300字以内。`

    const userPrompt = `项目名称：${data.projectName}
合同金额：${data.contractAmount}万元
当前成本消耗：${data.currentCost}万元
任务进度：${data.taskProgress}%

各阶段成本对比：
${data.stageCosts.map(s => `- ${s.stage}: 预期${s.expected}万, 实际${s.actual}万`).join('\n')}

各团队成本对比：
${data.teamCosts.map(t => `- ${t.team}: 预期${t.expected}万, 实际${t.actual}万`).join('\n')}

请分析偏差原因并给出调整建议。`

    return await this.chat(
      [{ role: 'user', content: userPrompt }],
      systemPrompt
    )
  }

  /**
   * 识别项目偏差截图（使用 OpenAI 多模态格式）
   */
  async recognizeProjectScreenshots(
    screenshots: { type: string; base64: string }[]
  ): Promise<DeviationAnalysisResult> {
    const systemPrompt = `你是一个专业的IT项目管理助手。请分析用户提供的项目截图（包括合同金额、人力成本、成员明细、任务进度等），提取以下信息：
1. 项目名称
2. 合同金额（万元）
3. 当前人力成本（万元）
4. 任务完成进度（百分比）
5. 项目成员信息

请以JSON格式返回结果。`

    const results: DeviationAnalysisResult = {
      projectName: '',
      contractAmount: 0,
      currentManpowerCost: 0,
      taskProgress: 0,
      members: [],
      suggestion: ''
    }

    for (const screenshot of screenshots) {
      try {
        const response = await axios.post<AIResponse>(
          this.apiUrl,
          {
            model: this.model,
            temperature: 0.7,
            stream: false,
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: [
                  { type: 'text', text: `请识别这张${screenshot.type}类型的截图并提取关键信息。` },
                  { type: 'image_url', image_url: { url: `data:image/png;base64,${screenshot.base64}` } }
                ]
              }
            ]
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json; charset=utf-8'
            },
            timeout: 60000
          }
        )

        if (response.data.choices && response.data.choices.length > 0) {
          const text = response.data.choices[0].message.content
          const jsonMatch = text.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            Object.assign(results, parsed)
          }
        }
      } catch (error) {
        console.error('[AI Service] 截图识别错误:', error)
      }
    }

    return results
  }

  /**
   * 检查AI服务可用性
   */
  async checkHealth(): Promise<boolean> {
    try {
      const result = await this.chat([
        { role: 'user', content: 'Hello, please respond with "OK" to confirm you are working.' }
      ])
      return result.toLowerCase().includes('ok')
    } catch {
      return false
    }
  }

  /**
   * 生成工作项描述
   * 根据需求文档内容，为每个阶段的功能点生成具体的工作项描述
   */
  async generateWorkItemDescriptions(params: {
    documentText: string
    projectName: string
    modules: { name: string; functions: string[] }[]
    phases: string[]
  }): Promise<Record<string, Record<string, string>>> {
    const { documentText, projectName, modules, phases } = params

    // 构建功能点列表
    const functionList: string[] = []
    for (const module of modules) {
      for (const func of module.functions) {
        functionList.push(`${module.name} - ${func}`)
      }
    }

    const prompt = `你是一个专业的软件项目工作量评估专家。请根据以下需求文档内容，为每个阶段的功能点生成具体的工作项描述。

项目名称：${projectName}

需求文档内容（摘要）：
${documentText.substring(0, 8000)}

需要生成描述的阶段：
${phases.join('、')}

功能点列表：
${functionList.map((f, i) => `${i + 1}. ${f}`).join('\n')}

要求：
1. 每个工作项描述必须结合需求文档中的实际内容，具体说明要做什么工作
2. 描述长度控制在30-100个字
3. 不同阶段的描述应体现该阶段的工作特点：
   - 需求：调研、分析、评审相关工作
   - UI设计：交互设计、视觉设计、评审相关工作
   - 技术设计：架构设计、数据模型设计、接口设计相关工作
   - 开发：编码、代码审查、单元测试相关工作
   - 技术测试：测试方案、测试执行、缺陷跟踪相关工作
   - 性能测试：性能方案、压力测试、优化分析相关工作
4. 描述要具体，不能泛泛而谈

请以JSON格式返回，格式如下：
{
  "需求": {
    "模块名 - 功能名": "具体工作项描述",
    ...
  },
  "UI设计": {
    ...
  },
  ...
}

只返回JSON，不要返回其他内容。`

    const systemPrompt = '你是一个专业的软件项目工作量评估专家。请只返回JSON格式结果，确保每个描述都在30-100字之间，并且结合需求文档的具体内容。'

    console.log(`[AI Service] 开始生成工作项描述，功能点数: ${functionList.length}`)

    try {
      const text = await this.chat(
        [{ role: 'user', content: prompt }],
        systemPrompt
      )

      if (!text) {
        throw new Error('AI模型返回为空')
      }

      // 解析 JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error('[AI Service] JSON 解析失败:', text.substring(0, 200))
        throw new Error('AI返回无法解析为JSON')
      }

      const result: Record<string, Record<string, string>> = JSON.parse(jsonMatch[0])
      console.log(`[AI Service] 工作项描述生成成功，阶段数: ${Object.keys(result).length}`)

      return result
    } catch (error) {
      console.error('[AI Service] 生成工作项描述失败:', error)
      // 返回空对象，后续会使用默认描述
      return {}
    }
  }
}

// 导出单例
export const aiService = new AIService()
export default aiService