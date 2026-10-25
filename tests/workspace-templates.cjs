const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const results = path.resolve(__dirname, '../test-results');
  fs.mkdirSync(results, { recursive: true });
  const runtime = page.frameLocator('#runtime');
  async function load(name) {
    await page.locator('#demo').click();
    await page.locator(`[data-template="${name}"]`).click();
  }
  async function download(id, filename) {
    const pending = page.waitForEvent('download');
    await page.locator(id).click();
    await (await pending).saveAs(path.join(results, filename));
  }
  async function rail(scope) {
    const pane = scope.locator('section[aria-label="全高工具側欄"]');
    const tools = scope.getByRole('navigation', { name: '面板工具列' });
    const workspace = scope.locator('section[aria-label="主要工作區"]');
    const geometry = await pane.evaluate(el => ({ top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom, height: innerHeight, desktop: innerWidth > 600 }));
    assert.equal(geometry.top, 0);
    assert.ok(Math.abs(geometry.bottom - geometry.height) <= 1);
    const expandedWidth = (await workspace.boundingBox()).width;
    async function state(visible) {
      assert.equal(await pane.isVisible(), visible);
      assert.ok(await tools.isVisible());
      for (const b of await tools.locator('button').all()) assert.equal(await b.getAttribute('aria-expanded'), String(visible));
    }
    for (const name of ['專案', '筆記', '設定']) {
      const button = scope.getByRole('button', { name: '切換' + name + '側欄' });
      if (await pane.locator('h2').textContent() !== name) await button.click();
      await state(true);
      assert.equal(await pane.locator('h2').textContent(), name);
      await button.click();
      await state(false);
      if (geometry.desktop) assert.ok((await workspace.boundingBox()).width > expandedWidth + 200);
      await button.click();
      await state(true);
    }
    await scope.getByRole('button', { name: '切換設定側欄' }).click();
    await scope.getByRole('button', { name: '切換專案側欄' }).click();
    await state(true);
    assert.equal(await pane.locator('h2').textContent(), '專案');
  }
  async function sticky(scope) {
    const header = scope.locator('header');
    const frame = await header.evaluate(el => { window.scrollTo(0, 700); return { y: el.getBoundingClientRect().top, scroll: window.scrollY, position: getComputedStyle(el).position }; });
    assert.equal(frame.position, 'sticky');
    assert.ok(frame.scroll >= 600);
    assert.ok(Math.abs(frame.y) <= 1);
    await scope.getByRole('link', { name: '練習', exact: true }).click();
    assert.ok(await header.evaluate(el => Math.abs(el.getBoundingClientRect().top) <= 1));
  }
  try {
    await page.goto(process.env.BUILDER_URL);
    await load('tool-rail');
    await download('#save-project', 'tool-rail-project.json');
    await page.locator('#preview-button').click();
    await rail(runtime);
    await page.screenshot({ path: path.join(results, 'tool-rail-preview.png') });
    await page.locator('#close-preview').click();
    await download('#export-html', 'tool-rail.html');
    const exported = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await exported.setViewportSize({ width: 1440, height: 900 });
    await exported.goto('file://' + path.join(results, 'tool-rail.html'));
    await rail(exported);
    await exported.screenshot({ path: path.join(results, 'tool-rail-desktop.png') });
    await exported.setViewportSize({ width: 390, height: 844 });
    await rail(exported);
    assert.ok(await exported.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await exported.screenshot({ path: path.join(results, 'tool-rail-mobile.png'), fullPage: true });
    await page.locator('#reset').click();
    await page.locator('#project-file').setInputFiles(path.join(results, 'tool-rail-project.json'));
    await page.locator('#preview-button').click();
    await rail(runtime);
    await page.locator('#close-preview').click();
    await load('sticky-header');
    await download('#save-project', 'sticky-header-project.json');
    await page.locator('#preview-button').click();
    await sticky(runtime);
    await page.screenshot({ path: path.join(results, 'sticky-header-preview.png') });
    await page.locator('#close-preview').click();
    await download('#export-html', 'sticky-header.html');
    await exported.goto('file://' + path.join(results, 'sticky-header.html'));
    await sticky(exported);
    assert.ok(await exported.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await exported.screenshot({ path: path.join(results, 'sticky-header-mobile.png') });
    assert.deepEqual(errors, []);
    console.log('PASS full-height sidebar, tool-button toggle/switch, content expansion, ARIA synchronization, JSON roundtrip, standalone mobile export; sticky header scrolling and anchor links');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
