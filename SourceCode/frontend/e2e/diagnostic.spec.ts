import { test, expect } from '@playwright/test';

test.describe('页面加载诊断', () => {
  test('诊断 - 检查JavaScript错误', async ({ page }) => {
    // 收集console错误
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
        console.log('Console Error:', msg.text());
      }
    });

    // 收集页面错误
    page.on('pageerror', error => {
      errors.push(error.message);
      console.log('Page Error:', error.message);
    });

    // 访问首页
    await page.goto('/dashboard');

    // 等待React应用加载
    await page.waitForSelector('#root > *', { timeout: 30000 });

    // 等待页面稳定
    await page.waitForLoadState('networkidle');

    // 截图
    await page.screenshot({ path: 'test-results/diagnostic-01.png', fullPage: true });

    // 输出错误
    console.log('\n收集到的错误:', errors);

    // 检查root div是否有内容
    const rootContent = await page.locator('#root').innerHTML();
    console.log('Root div内容长度:', rootContent.length);
    console.log('Root div内容前500字符:', rootContent.substring(0, 500));

    // 检查是否有ant-design组件
    const antLayout = await page.locator('.ant-layout').count();
    console.log('ant-layout数量:', antLayout);

    // 检查是否有任何可见文本
    const bodyText = await page.locator('body').textContent();
    console.log('Body文本内容:', bodyText?.substring(0, 500));

    // 等待更长时间后再次检查
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'test-results/diagnostic-02-wait.png', fullPage: true });

    const rootContentAfterWait = await page.locator('#root').innerHTML();
    console.log('等待5秒后Root div内容长度:', rootContentAfterWait.length);
  });

  test('诊断 - 直接访问检查', async ({ page }) => {
    // 收集所有console消息
    page.on('console', msg => {
      console.log(`Console ${msg.type()}:`, msg.text());
    });

    // 访问首页
    await page.goto('/dashboard', { waitUntil: 'commit' });

    console.log('页面URL:', page.url());
    console.log('页面标题:', await page.title());

    // 立即截图
    await page.screenshot({ path: 'test-results/diagnostic-03-immediate.png' });

    // 等待10秒
    await page.waitForTimeout(10000);

    // 再次截图
    await page.screenshot({ path: 'test-results/diagnostic-04-10s.png', fullPage: true });

    // 检查页面状态
    const rootHTML = await page.locator('#root').innerHTML();
    console.log('等待10秒后root内容:', rootHTML.substring(0, 1000));

    // 尝试点击任何元素
    const clickableElements = await page.locator('button, a, [role="button"]').count();
    console.log('可点击元素数量:', clickableElements);

    // 获取页面完整的HTML
    const fullHTML = await page.content();
    console.log('完整HTML长度:', fullHTML.length);
  });

  test('诊断 - 使用Playwright trace', async ({ page, context }) => {
    // 启用trace
    await context.tracing.start({ screenshots: true, snapshots: true });

    // 访问首页
    await page.goto('/dashboard');
    await page.waitForTimeout(5000);

    // 停止trace并保存
    await context.tracing.stop({ path: 'test-results/trace.zip' });

    // 截图
    await page.screenshot({ path: 'test-results/diagnostic-05-trace.png', fullPage: true });

    console.log('Trace已保存到 test-results/trace.zip');
  });
});