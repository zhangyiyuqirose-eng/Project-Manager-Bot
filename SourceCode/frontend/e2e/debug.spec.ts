import { test, expect } from '@playwright/test';

test.describe('页面结构调试', () => {
  test('调试 - 获取页面结构', async ({ page }) => {
    // 访问首页
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // 获取页面标题
    const title = await page.title();
    console.log('页面标题:', title);

    // 截图
    await page.screenshot({ path: 'test-results/debug-01-dashboard.png', fullPage: true });

    // 获取页面HTML结构
    const html = await page.content();

    // 检查是否有nav标签
    const navCount = await page.locator('nav').count();
    console.log('nav标签数量:', navCount);

    // 检查是否有ant-layout-header
    const headerCount = await page.locator('.ant-layout-header').count();
    console.log('ant-layout-header数量:', headerCount);

    // 检查是否有button元素
    const buttonCount = await page.locator('button').count();
    console.log('button元素数量:', buttonCount);

    // 检查是否有文本"成本预估"
    const costEstimate = await page.locator('text=成本预估').count();
    console.log('"成本预估"文本数量:', costEstimate);

    // 检查是否有文本"成本消耗"
    const costConsumption = await page.locator('text=成本消耗').count();
    console.log('"成本消耗"文本数量:', costConsumption);

    // 检查是否有文本"偏差监控"
    const deviation = await page.locator('text=偏差监控').count();
    console.log('"偏差监控"文本数量:', deviation);

    // 检查是否有文本"项目"
    const project = await page.locator('text=项目').count();
    console.log('"项目"文本数量:', project);

    // 检查是否有IT项目智能文本
    const itProject = await page.locator('text=IT项目智能').count();
    console.log('"IT项目智能"文本数量:', itProject);

    // 尝试获取header区域的内容
    if (headerCount > 0) {
      const headerContent = await page.locator('.ant-layout-header').textContent();
      console.log('Header内容:', headerContent?.substring(0, 200));
    }

    // 检查所有包含"成本"的元素
    const costElements = await page.locator('text=/成本/').allTextContents();
    console.log('包含"成本"的元素:', costElements);

    // 截取header区域
    if (headerCount > 0) {
      await page.locator('.ant-layout-header').screenshot({ path: 'test-results/debug-02-header.png' });
    }

    // 获取页面body的innerHTML（前1000字符）
    const bodyHTML = await page.locator('body').innerHTML();
    console.log('Body HTML (前500字符):', bodyHTML.substring(0, 500));
  });

  test('调试 - 等待更长时间后检查', async ({ page }) => {
    // 访问首页
    await page.goto('/dashboard');

    // 等待更长时间
    await page.waitForTimeout(3000);
    await page.waitForLoadState('domcontentloaded');

    // 截图
    await page.screenshot({ path: 'test-results/debug-03-wait.png', fullPage: true });

    // 获取所有可见的按钮文本
    const buttons = await page.locator('button:visible').allTextContents();
    console.log('可见按钮文本:', buttons);

    // 获取所有span元素
    const spans = await page.locator('span').allTextContents();
    console.log('span文本数量:', spans.length);

    // 查找导航菜单的位置
    const navButton = page.locator('button').filter({ hasText: '成本预估' });
    const navButtonCount = await navButton.count();
    console.log('包含"成本预估"的按钮数量:', navButtonCount);

    if (navButtonCount > 0) {
      console.log('找到成本预估按钮!');
      await navButton.first().click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/debug-04-click.png', fullPage: true });
    }
  });
});