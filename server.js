const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const quizRoot = __dirname;
const assetsRoot = path.join(quizRoot, 'assets');
const modelRoot = path.join(quizRoot, 'models');
const visionRoot = path.join(quizRoot, 'vendor', 'mediapipe');
const port = Number(process.env.PORT) || 8765;
const host = '127.0.0.1';

const directFiles = new Map([
  ['/', path.join(quizRoot, 'index.html')],
  ['/index.html', path.join(quizRoot, 'index.html')],
  ['/Step_Quiz.html', path.join(quizRoot, 'Step_Quiz.html')],
  ['/style.css', path.join(quizRoot, 'style.css')],
  ['/app.js', path.join(quizRoot, 'app.js')],
  ['/questions.mjs', path.join(quizRoot, 'questions.mjs')]
]);

const fileTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream'
};

function scopedFile(urlPath, prefix, root) {
  if (!urlPath.startsWith(prefix)) return null;
  const relative = urlPath.slice(prefix.length);
  const resolved = path.resolve(root, relative);
  return resolved.startsWith(root + path.sep) ? resolved : null;
}

function requestedFile(urlPath) {
  return directFiles.get(urlPath)
    || scopedFile(urlPath, '/assets/', assetsRoot)
    || scopedFile(urlPath, '/models/', modelRoot)
    || scopedFile(urlPath, '/vendor/mediapipe/', visionRoot);
}

const server = http.createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405).end('Method not allowed');
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }
  const filename = requestedFile(pathname);
  if (!filename) {
    response.writeHead(404).end('Not found');
    return;
  }
  fs.stat(filename, (error, stat) => {
    if (error || !stat.isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': fileTypes[path.extname(filename)] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache'
    });
    if (request.method === 'HEAD') response.end();
    else fs.createReadStream(filename).pipe(response);
  });
});

server.listen(port, host, () => {
  const url = 'http://' + host + ':' + port;
  console.log('Step Up quiz is ready at ' + url);
  if (process.argv.includes('--open') && process.platform === 'win32') {
    spawn('explorer.exe', [url], { windowsHide: true, detached: true, stdio: 'ignore' }).unref();
  }
});
