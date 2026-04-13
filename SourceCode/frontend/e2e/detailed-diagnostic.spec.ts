import { test, expect } from '@playwright/test';

test.describe('详细诊断', () => {
  test('详细诊断 - 检查所有网络请求', async ({ page }) => {
    // 收集所有网络请求
    const requests: { url: string; status: number; method: string }[] = [];
    const failedRequests: { url: string; status: number; method: string }[] = [];

    page.on('request', request => {
      console.log(`Request: ${request.method()} ${request.url()}`);
    });

    page.on('response', response => {
      const url = response.url();
      const status = response.status();
      const method = response.request().method();

      requests.push({ url, status, method });

      if (status >= 400) {
        failedRequests.push({ url, status, method });
        console.log(`FAILED Response: ${status} ${url}`);
      }
    });

    // 收集console消息
    page.on('console', msg => {
      console.log(`Console ${msg.type()}:`, msg.text());
    });

    // 收集页面错误
    page.on('pageerror', error => {
      console.log('Page Error:', error.message);
    });

    // 访问首页
    console.log('\n=== 开始访问页面 ===');
    await page.goto('/dashboard');

    // 等待一段时间让所有请求完成
    await page.waitForTimeout(5000);

    // 输出所有失败的请求
    console.log('\n=== 失败的请求 ===');
    for (const req of failedRequests) {
      console.log(`${req.status} ${req.method} ${req.url}`);
    }

    // 输出请求统计
    console.log('\n=== 请求统计 ===');
    console.log(`总请求数: ${requests.length}`);
    console.log(`失败请求数: ${failedRequests.length}`);

    // 截图
    await page.screenshot({ path: 'test-results/detailed-diagnostic-01.png', fullPage: true });

    // 检查页面状态
    const rootHTML = await page.locator('#root').innerHTML();
    console.log('\n=== Root内容 ===');
    console.log(`Root div内容长度: ${rootHTML.length}`);
    console.log(`Root div内容: ${rootHTML.substring(0, 500)}`);

    // 检查是否有React组件渲染
    const antLayout = await page.locator('.ant-layout').count();
    const antButton = await page.locator('.ant-btn').count();
    const antCard = await page.locator('.ant-card').count();

    console.log('\n=== Ant Design组件统计 ===');
    console.log(`ant-layout: ${antLayout}`);
    console.log(`ant-btn: ${antButton}`);
    console.log(`ant-card: ${antCard}`);

    // 尝试刷新页面
    console.log('\n=== 尝试刷新页面 ===');
    await page.reload();
    await page.waitForTimeout(5000);

    await page.screenshot({ path: 'test-results/detailed-diagnostic-02-refresh.png', fullPage: true });

    const rootHTMLAfterRefresh = await page.locator('#root').innerHTML();
    console.log(`刷新后Root div内容长度: ${rootHTMLAfterRefresh.length}`);
  });

  test('验证 - 使用真实浏览器环境', async ({ page }) => {
    // 访问首页
    await page.goto('/dashboard');

    // 等待页面完全加载
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // 截图
    await page.screenshot({ path: 'test-results/real-browser-01.png', fullPage: true });

    // 检查页面标题
    const title = await page.title();
    console.log('页面标题:', title);
    expect(title).toContain('IT项目智能成本管控平台');

    // 等待页面渲染完成
    try {
      await page.waitForSelector('.ant-layout', { timeout: 10000 });
      console.log('找到ant-layout组件');

      // 再次截图
      await page.screenshot({ path: 'test-results/real-browser-02-layout.png', fullPage: true });

      // 检查导航菜单
      const menuButtons = await page.locator('button').allTextContents();
      console.log('按钮文本:', menuButtons);

      // 检查是否有"成本预估"文本
      const costEstimateText = await page.locator('text=成本预估').count();
      console.log('"成本预估"文本数量:', costEstimateText);

    } catch (e) {
      console.log('等待ant-layout超时');
      const rootContent = await page.locator('#root').innerHTML();
      console.log('Root内容:', rootContent);
    }
  });
});