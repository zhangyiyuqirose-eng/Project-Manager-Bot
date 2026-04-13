import { test, expect } from '@playwright/test';

test.describe('IT项目智能成本管控平台 - 功能验证', () => {
  test.beforeEach(async ({ page }) => {
    // 访问首页
    await page.goto('/dashboard');
    // 等待页面加载完成
    await page.waitForLoadState('networkidle');
    // 等待React应用渲染
    await page.waitForSelector('.ant-layout', { timeout: 10000 });
  });

  test('1. 访问首页并检查标题', async ({ page }) => {
    // 检查页面标题
    const title = await page.title();
    console.log('页面标题:', title);

    // 截图
    await page.screenshot({ path: 'test-results/01-dashboard.png', fullPage: true });

    // 检查标题是否包含关键字
    expect(title).toContain('IT项目智能成本管控平台');

    // 检查首页标题文本
    const heroTitle = page.locator('h1:has-text("IT项目智能成本管控平台")');
    await expect(heroTitle).toBeVisible();
  });

  test('2. 检查导航菜单项', async ({ page }) => {
    // 检查菜单项是否存在（使用button标签）
    const menuItems = ['首页', '成本预估', '成本消耗', '偏差监控', '项目'];

    for (const item of menuItems) {
      const menuItem = page.locator(`button:has-text("${item}")`).first();
      await expect(menuItem).toBeVisible({ timeout: 5000 });
      console.log(`菜单项 "${item}" 存在`);
    }

    // 截图
    await page.screenshot({ path: 'test-results/02-menu.png', fullPage: true });
  });

  test('3. 点击成本消耗菜单并检查数据输入页面', async ({ page }) => {
    // 点击"成本消耗"菜单
    const costConsumptionMenu = page.locator('button:has-text("成本消耗")').first();
    await costConsumptionMenu.click();

    // 等待子菜单出现
    await page.waitForTimeout(500);

    // 点击"数据输入"子菜单
    const dataInputSubmenu = page.locator('text=数据输入').first();
    await expect(dataInputSubmenu).toBeVisible();
    await dataInputSubmenu.click();

    // 等待页面跳转
    await page.waitForURL('**/cost-consumption/input**', { timeout: 10000 });

    // 截图
    await page.screenshot({ path: 'test-results/03-cost-consumption.png', fullPage: true });

    // 检查URL是否正确
    expect(page.url()).toContain('cost-consumption/input');

    // 检查页面是否有输入框
    const inputs = await page.locator('input').count();
    console.log(`页面输入框数量: ${inputs}`);
    expect(inputs).toBeGreaterThan(0);
  });

  test('4. 点击偏差监控菜单检查子菜单', async ({ page }) => {
    // 点击"偏差监控"菜单
    const deviationMenu = page.locator('button:has-text("偏差监控")').first();
    await deviationMenu.click();

    // 等待子菜单展开
    await page.waitForTimeout(500);

    // 截图（子菜单展开状态）
    await page.screenshot({ path: 'test-results/04-deviation-monitor-menu.png', fullPage: true });

    // 检查子菜单项是否存在
    const submenuItems = ['数据输入', '偏差分析', '项目人员清单'];

    for (const item of submenuItems) {
      const submenu = page.locator(`text=${item}`).first();
      const isVisible = await submenu.isVisible();
      console.log(`子菜单项 "${item}" ${isVisible ? '可见' : '不可见'}`);
      expect(isVisible).toBeTruthy();
    }

    // 特别检查"项目人员清单"
    const memberListSubmenu = page.locator('text=项目人员清单').first();
    await expect(memberListSubmenu).toBeVisible();
  });

  test('5. 首页完整功能验证', async ({ page }) => {
    // 首页截图
    await page.screenshot({ path: 'test-results/05-home-full.png', fullPage: true });

    // 检查Logo区域（使用strong标签限定）
    const logoText = page.locator('strong:has-text("IT项目智能")');
    await expect(logoText).toBeVisible();

    // 检查副标题（使用span或div限定）
    const subtitle = page.locator('span:has-text("成本管控平台")').or(page.locator('div:has-text("成本管控平台"):not(:has(h1))'));
    await expect(subtitle.first()).toBeVisible();

    // 检查面包屑
    const breadcrumb = page.locator('.ant-breadcrumb');
    await expect(breadcrumb).toBeVisible();

    // 检查用户头像区域
    const userAvatar = page.locator('.ant-avatar');
    await expect(userAvatar.first()).toBeVisible();

    // 检查功能卡片
    const cards = page.locator('.ant-card');
    const cardCount = await cards.count();
    console.log(`功能卡片数量: ${cardCount}`);
    expect(cardCount).toBe(3);

    console.log('首页功能验证完成');
  });

  test('6. 完整导航流程测试', async ({ page }) => {
    // 测试每个主菜单的子菜单
    const menus = [
      { name: '成本预估', submenus: ['数据上传', '参数配置', '预估结果'] },
      { name: '成本消耗', submenus: ['数据输入', '预估结果'] },
      { name: '偏差监控', submenus: ['数据输入', '偏差分析', '项目人员清单'] },
      { name: '项目', submenus: ['项目列表'] },
    ];

    for (const menu of menus) {
      // 点击主菜单
      const menuButton = page.locator(`button:has-text("${menu.name}")`).first();
      await menuButton.click();
      await page.waitForTimeout(300);

      console.log(`\n主菜单 "${menu.name}" 子菜单:`);

      // 检查每个子菜单
      for (const submenu of menu.submenus) {
        const submenuItem = page.locator(`text=${submenu}`).first();
        const isVisible = await submenuItem.isVisible();
        console.log(`  - ${submenu}: ${isVisible ? '可见' : '不可见'}`);
        expect(isVisible).toBeTruthy();
      }

      // 点击页面其他地方关闭菜单
      await page.click('body');
      await page.waitForTimeout(200);
    }

    // 最终截图
    await page.screenshot({ path: 'test-results/06-all-menus.png', fullPage: true });
  });
});