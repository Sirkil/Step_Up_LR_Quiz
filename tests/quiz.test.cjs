const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('document questions retain the 12-point answer guide', async () => {
  const { questions, maxScore, pointsForAnswer } = await import('../questions.mjs');
  assert.equal(questions.length, 25);
  assert.equal(maxScore, 12);
  assert.equal(questions.filter((question) => question.correct === null).length, 13);
  assert.equal(questions[0].text, 'Have you ever run faster for a deadline than for a workout?');
  assert.equal(questions.at(-1).text, 'Is early diagnosis important in managing Pompe disease?');

  for (const question of questions) {
    assert.ok(question.text.endsWith('?'));
    assert.equal(pointsForAnswer(question, true), question.correct === true ? 1 : 0);
    assert.equal(pointsForAnswer(question, false), question.correct === false ? 1 : 0);
  }
});

function freePort() {
  return new Promise((resolve, reject) => {
    const listener = net.createServer();
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', () => {
      const port = listener.address().port;
      listener.close(() => resolve(port));
    });
  });
}

test('server delivers the quiz, questions, and local artwork', async () => {
  const port = await freePort();
  const child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server did not start')), 5000);
      child.stdout.once('data', () => { clearTimeout(timeout); resolve(); });
      child.once('error', reject);
      child.once('exit', (code) => reject(new Error(`Server exited with ${code}`)));
    });
    for (const [url, type] of [
      ['/', 'text/html'],
      ['/app.js', 'text/javascript'],
      ['/questions.mjs', 'text/javascript'],
      ['/style.css', 'text/css'],
      ['/assets/Logo_White.png', 'image/png'],
      ['/assets/Background_V2.png', 'image/png']
    ]) {
      const response = await fetch(`http://127.0.0.1:${port}${url}`);
      assert.equal(response.status, 200, url);
      assert.ok(response.headers.get('content-type').startsWith(type), url);
      assert.ok((await response.arrayBuffer()).byteLength > 0, url);
    }
  } finally {
    child.kill();
  }
});
