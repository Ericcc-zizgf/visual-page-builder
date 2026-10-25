const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (r.url().includes('example.invalid')) requests.push(r.url()); });
  const canvas = page.frameLocator('#canvas'), runtime = page.frameLocator('#runtime');
  const result = page.locator('#source-result');
  const results = path.resolve(__dirname, '../test-results');
  fs.mkdirSync(results, { recursive: true });
  async function analyze() {
    await page.locator('#analyze-source').click();
    await page.locator('#analyze-source').waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('#analyze-source').disabled);
    assert.match(await result.textContent(), /轉換完成/);
  }
  const html = `<!doctype html><html><head><title>原始碼測試</title>
    <link rel="stylesheet" href="assets/layout.css"><style>.cards { gap: 12px; } #heading { color: #123456; }</style>
    </head><body><header><h1 id="heading" style="margin:0">匯入測試</h1></header>
    <button id="toggle">切換側欄</button><div class="layout"><nav id="sidebar">導覽</nav>
    <section class="cards"><article>第一張</article><article>第二張</article><article>第三張</article></section></div>
    <p id="count">0</p><button id="add">加一</button><input id="name"><p id="output">尚未輸入</p>
    <button id="check">檢查</button><p id="feedback">等待</p>
    <img src="https://example.invalid/image.png" alt="圖片待上傳">
    <iframe src="https://example.invalid/frame"></iframe>
    <script src="assets/actions.js"></script><script>window.__sourceExecuted = true;</script></body></html>`;
  const css = `body{margin:0;color:#263c2d} .layout {display:flex} nav {width:180px;flex:0 0 180px}
    .cards {display:grid;grid-template-columns:repeat(3,1fr);flex:1;gap:20px}
    #heading {color:red} @media(max-width:1024px){.cards{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:600px){.cards{grid-template-columns:1fr}nav{width:100px;flex-basis:100px}}
    .cards:hover {background:red} .cards::before{content:'decoration'}`;
  const js = `const toggle = document.getElementById('toggle'); const sidebar = document.querySelector('#sidebar');
    toggle.addEventListener('click', () => { sidebar.hidden = !sidebar.hidden; });
    const add = document.getElementById('add'); const count = document.getElementById('count');
    add.addEventListener('click', () => { count.textContent = String(Number(count.textContent) + 1); });
    const input = document.getElementById('name'); const output = document.getElementById('output');
    input.addEventListener('input', event => { output.textContent = event.currentTarget.value; });
    const check = document.getElementById('check');const feedback = document.getElementById('feedback');
    check.addEventListener('click',()=>{if(input.value === ''){feedback.textContent='請輸入';}else{feedback.textContent='完成';}});
    check.addEventListener('click',()=>{feedback.textContent='不應部分匯入'; fetch('https://example.invalid/api');});`;
  try {
    await page.goto(process.env.BUILDER_URL);
    await canvas.locator('#root').waitFor();
    await page.locator('[data-component="h1"]').click();
    await page.locator('#import-source').click();
    await page.locator('#source-files').setInputFiles([
      { name: 'index.html', mimeType: 'text/html', buffer: Buffer.from(html) },
      { name: 'layout.css', mimeType: 'text/css', buffer: Buffer.from(css) },
      { name: 'actions.js', mimeType: 'text/javascript', buffer: Buffer.from(js) },
    ]);
    await page.waitForFunction(() => document.querySelector('#source-file-status').textContent.includes('已讀取'));
    await analyze();
    assert.equal(await canvas.locator('h1').textContent(), '我的網頁標題');
    assert.match(await result.textContent(), /未轉換/);
    assert.match(await result.textContent(), /外部.*圖片/);
    assert.equal(await page.evaluate(() => window.__sourceExecuted), undefined);
    assert.deepEqual(requests, []);
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#download-source').click();
    const download = await downloadPromise, projectPath = path.join(results, 'source-import.json');
    await download.saveAs(projectPath);
    const project = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
    const all = node => [node, ...node.children.flatMap(all)];
    const nodes = all(project.root);
    const cards = nodes.find(n => n.tag === 'section');
    assert.equal(cards.styles.gap, '12px');
    assert.match(cards.styles['grid-template-columns'], /repeat\(3/);
    assert.match(cards.responsive.tablet['grid-template-columns'], /repeat\(2/);
    assert.ok(cards.responsive.mobile['grid-template-columns']);
    assert.equal(nodes.find(n => n.tag === 'h1').styles.color, 'rgb(18, 52, 86)');
    assert.equal(nodes.reduce((total, n) => total + n.actions.length, 0), 4);
    await page.locator('#load-source').click();
    await canvas.getByRole('heading', { name: '匯入測試' }).waitFor();
    await page.locator('#preview-button').click();
    await runtime.getByRole('button', { name: '切換側欄' }).click();
    assert.equal(await runtime.locator('nav').isVisible(), false);
    await runtime.getByRole('button', { name: '切換側欄' }).click();
    assert.equal(await runtime.locator('nav').isVisible(), true);
    await runtime.getByRole('button', { name: '加一' }).click();
    assert.equal(await runtime.locator('#' + nodes.find(n => n.tag === 'p' && n.text === '0').id).textContent(), '1');
    await runtime.getByRole('button', { name: '檢查' }).click();
    assert.equal(await runtime.getByText('請輸入', { exact: true }).count(), 1);
    await runtime.locator('input').fill('小明');
    assert.equal(await runtime.getByText('小明', { exact: true }).count(), 1);
    await runtime.getByRole('button', { name: '檢查' }).click();
    assert.equal(await runtime.getByText('完成', { exact: true }).count(), 1);
    await page.locator('#close-preview').click();
    await page.locator('#undo').click();
    await canvas.getByRole('heading', { name: '我的網頁標題' }).waitFor();
    await page.locator('#redo').click();
    await canvas.getByRole('heading', { name: '匯入測試' }).waitFor();
    await page.locator('#import-source').click();
    await page.locator('#source-html').fill('');
    assert.equal(await page.locator('#load-source').isDisabled(), true);
    await page.locator('#analyze-source').click();
    await page.waitForFunction(() => !document.querySelector('#analyze-source').disabled);
    assert.match(await result.textContent(), /轉換失敗/);
    await page.locator('#close-source').click();
    assert.equal(await canvas.locator('h1').textContent(), '匯入測試');
    // Existing builder-generated JavaScript must also round-trip through static analysis.
    await page.locator('#demo').click();await page.locator('[data-template="sidebar"]').click();
    const htmlPromise = page.waitForEvent('download');
    await page.locator('#export-html').click();
    const htmlDownload = await htmlPromise, exportPath = path.join(results, 'source-sidebar.html');
    await htmlDownload.saveAs(exportPath);
    await page.locator('#import-source').click();
    await page.locator('#source-files').setInputFiles(exportPath);
    await page.waitForFunction(() => document.querySelector('#source-file-status').textContent.includes('source-sidebar.html'));
    await analyze();
    assert.match(await result.textContent(), /5 筆互動/);
    await page.locator('#load-source').click();
    await page.locator('#preview-button').click();
    await runtime.getByRole('button', { name: '☰ 收合側邊欄' }).click();
    assert.equal(await runtime.locator('nav').isVisible(), false);
    await runtime.getByRole('button', { name: '☰ 展開側邊欄' }).click();
    assert.equal(await runtime.locator('nav').isVisible(), true);
    await page.locator('#close-preview').click();
    await page.locator('#import-source').click();
    await page.screenshot({ path: path.join(results, 'source-import-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(results, 'source-import-mobile.png'), fullPage: true });
    assert.deepEqual(errors, []);
    console.log('PASS source files, CSS cascade/responsive, static JS toggle/count/input/conditions, unsupported handler rejection, no source execution/requests, JSON download, undo/redo, failed conversion preserves draft, builder sidebar round trip, mobile dialog');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
