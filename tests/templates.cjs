const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const canvas = page.frameLocator('#canvas'), runtime = page.frameLocator('#runtime');
  const results = path.resolve(__dirname, '../test-results');
  fs.mkdirSync(results, { recursive: true });
  async function preview() {
    await page.locator('#preview-button').click();
    await runtime.getByRole('button', { name: '☰ 收合側邊欄', exact: true }).waitFor();
  }
  async function checkToggle(scope) {
    const nav = scope.getByRole('navigation', { name: '工作空間導覽', includeHidden: true });
    const button = scope.getByRole('button', { name: /☰ .*側邊欄/ });
    assert.equal(await button.getAttribute('aria-controls'), await nav.getAttribute('id'));
    assert.equal(await button.getAttribute('aria-expanded'), 'true');
    const content = scope.locator('section');
    const before = (await content.boundingBox()).width;
    for (let i = 0; i < 3; i++) {
      await button.click();
      assert.equal(await nav.isVisible(), false);
      assert.equal(await button.textContent(), '☰ 展開側邊欄');
      assert.equal(await button.getAttribute('aria-expanded'), 'false');
      assert.ok((await content.boundingBox()).width > before + 100);
      await button.click();
      assert.equal(await nav.isVisible(), true);
      assert.equal(await button.textContent(), '☰ 收合側邊欄');
      assert.equal(await button.getAttribute('aria-expanded'), 'true');
    }
    await scope.getByRole('button', { name: '我的專案', exact: true }).click();
    assert.equal(await scope.locator('section > h2').textContent(), '我的專案');
  }
  try {
    await page.goto(process.env.BUILDER_URL);
    await canvas.locator('#root').waitFor();
    await page.locator('#demo').click();
    await page.locator('#close-templates').click();
    assert.equal(await canvas.locator('#root > *').count(), 0);
    await page.locator('#demo').click();
    await page.locator('[data-template="sidebar"]').click();
    await canvas.locator('nav').waitFor();
    assert.equal(await page.locator('#project-name').inputValue(), '可收合側邊欄範例');
    await page.locator('#undo').click();
    await canvas.locator('nav').waitFor({ state: 'detached' });
    await page.locator('#redo').click();
    await canvas.locator('nav').waitFor();
    await preview();
    await checkToggle(runtime);
    await page.locator('#close-preview').click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#save-project').click();
    const download = await downloadPromise;
    const projectPath = path.join(results, 'sidebar-project.json');
    await download.saveAs(projectPath);
    await page.locator('#reset').click();
    await page.locator('#project-file').setInputFiles(projectPath);
    await canvas.locator('nav').waitFor();
    await page.waitForTimeout(300);
    await page.reload();
    await canvas.locator('nav').waitFor();
    await preview();
    await checkToggle(runtime);
    await page.screenshot({ path: path.join(results, 'sidebar-preview.png'), fullPage: true });
    await page.locator('#close-preview').click();
    const htmlPromise = page.waitForEvent('download');
    await page.locator('#export-html').click();
    const html = await htmlPromise;
    const exportPath = path.join(results, 'sidebar.html');
    await html.saveAs(exportPath);
    const exported = await browser.newPage();
    await exported.goto('file://' + exportPath);
    await checkToggle(exported);
    await exported.setViewportSize({ width: 375, height: 812 });
    await exported.reload();
    await checkToggle(exported);
    assert.equal(await exported.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await exported.screenshot({ path: path.join(results, 'sidebar-mobile.png'), fullPage: true });
    await exported.close();
    assert.deepEqual(errors, []);
    console.log('PASS template picker, cancel, sidebar toggle and expansion, navigation, undo/redo, JSON round trip, persistence, offline export, mobile layout');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
