// Optional visual/game-flow check. Set PLAYWRIGHT_MODULE to a Playwright install.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function main() {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const { questions, maxScore } = await import(pathToFileURL(path.resolve(__dirname, '..', 'questions.mjs')));
  const port = await new Promise((resolve) => {
    const listener = net.createServer().listen(0, '127.0.0.1', () => {
      const value = listener.address().port;
      listener.close(() => resolve(value));
    });
  });
  const server = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'), env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe']
  });
  let browser;
  let staticServer;
  try {
    await new Promise((resolve, reject) => {
      server.stdout.once('data', resolve);
      server.once('error', reject);
    });
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROME_PATH || undefined
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}/?demo=1`);
    await page.locator('#startButton').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#startupScreen').isVisible(), true);
    await page.screenshot({ path: path.join(os.tmpdir(), 'step-quiz-start-landscape.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(os.tmpdir(), 'step-quiz-start-portrait.png') });
    await page.clock.install();
    await page.locator('#startButton').click();
    assert.equal(await page.locator('#progressText').textContent(), 'Question 1 of 25');

    for (let index = 0; index < questions.length; index++) {
      await page.clock.runFor(2700);
      assert.equal(await page.locator('#questionText').textContent(), questions[index].text);
      assert.equal(await page.locator('#choices').getAttribute('aria-hidden'), 'false');
      if (index === 0) {
        const left = await page.locator('#trueChoice').boundingBox();
        const right = await page.locator('#falseChoice').boundingBox();
        assert.ok(left.x + left.width <= right.x);
        await page.screenshot({ path: path.join(os.tmpdir(), 'step-quiz-question-portrait.png') });
        await page.setViewportSize({ width: 844, height: 390 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        assert.equal(await page.evaluate(() => document.querySelector('.position-bar').getBoundingClientRect().bottom <= innerHeight), true);
        await page.screenshot({ path: path.join(os.tmpdir(), 'step-quiz-question-landscape.png') });
      }
      await page.keyboard.press(questions[index].correct === false ? 'ArrowRight' : 'ArrowLeft');
      await page.clock.runFor(2000);
    }

    assert.equal(await page.locator('#completionScreen').isVisible(), true);
    assert.equal(await page.locator('#finalScore').textContent(), `${maxScore} / ${maxScore} points`);
    assert.equal(await page.evaluate(() => document.querySelector('#completionStatus').getBoundingClientRect().bottom <= innerHeight), true);
    await page.screenshot({ path: path.join(os.tmpdir(), 'step-quiz-complete-landscape.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.querySelector('#completionStatus').getBoundingClientRect().bottom <= innerHeight), true);
    await page.screenshot({ path: path.join(os.tmpdir(), 'step-quiz-complete-portrait.png') });
    await page.locator('#restartButton').click();
    assert.equal(await page.locator('#progressText').textContent(), 'Question 1 of 25');
    assert.equal(await page.locator('#scoreText').textContent(), `0 / ${maxScore}`);
    const modelPage = await browser.newPage();
    modelPage.on('pageerror', (error) => errors.push(error.message));
    await modelPage.goto(`http://127.0.0.1:${port}/?demo=1&models=1`);
    await modelPage.locator('#startButton').waitFor({ state: 'visible', timeout: 30000 });

    // GitHub Pages serves a project below /REPOSITORY/, with no Node server.
    const staticRoot = path.resolve(__dirname, '..');
    staticServer = http.createServer((request, response) => {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const prefix = '/Step_Up_LR_Quiz/';
      if (!pathname.startsWith(prefix)) return response.writeHead(404).end();
      const relative = pathname.slice(prefix.length) || 'index.html';
      const filename = path.resolve(staticRoot, relative);
      if (!filename.startsWith(staticRoot + path.sep)) return response.writeHead(404).end();
      const extension = path.extname(filename);
      const type = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.png': 'image/png' }[extension] || 'application/octet-stream';
      response.setHeader('Content-Type', type);
      fs.createReadStream(filename).on('error', () => response.writeHead(404).end()).pipe(response);
    });
    await new Promise((resolve) => staticServer.listen(0, '127.0.0.1', resolve));
    const staticPort = staticServer.address().port;
    const pagesPage = await browser.newPage();
    pagesPage.on('pageerror', (error) => errors.push(error.message));
    await pagesPage.goto(`http://127.0.0.1:${staticPort}/Step_Up_LR_Quiz/?demo=1&models=1`);
    await pagesPage.locator('#startButton').waitFor({ state: 'visible', timeout: 30000 });
    await pagesPage.locator('#startButton').click();
    assert.equal(await pagesPage.locator('#progressText').textContent(), 'Question 1 of 25');
    assert.deepEqual(errors, []);
    console.log('Browser flow passed: 25 questions, final score, restart, both orientations, models, GitHub Pages subpath.');
    console.log(path.join(os.tmpdir(), 'step-quiz-start-portrait.png'));
    console.log(path.join(os.tmpdir(), 'step-quiz-question-landscape.png'));
    console.log(path.join(os.tmpdir(), 'step-quiz-complete-landscape.png'));
  } finally {
    if (browser) await browser.close();
    if (staticServer) await new Promise((resolve) => staticServer.close(resolve));
    server.kill();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
