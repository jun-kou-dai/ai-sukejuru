const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8081;
const DIST = path.join(__dirname, 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};

// Empty service worker that unregisters itself - replaces any old cached SW
const EMPTY_SW = `self.addEventListener('install', function() { self.skipWaiting(); });
self.addEventListener('activate', function() {
  self.registration.unregister();
  self.clients.matchAll().then(function(clients) {
    clients.forEach(function(client) { client.navigate(client.url); });
  });
});`;

// First-visit page: clears ALL caches/SW then loads the real app
const CACHE_CLEAR_PAGE = `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8">
<title>読み込み中...</title>
<style>body{display:flex;justify-content:center;align-items:center;height:100vh;margin:0;font-family:sans-serif;background:#f5f5f5;}
.msg{text-align:center;color:#333;}</style></head>
<body><div class="msg"><p>キャッシュをクリアしています...</p></div>
<script>
(async function(){
  // 1. Unregister ALL service workers
  if('serviceWorker' in navigator){
    var regs=await navigator.serviceWorker.getRegistrations();
    for(var r of regs){await r.unregister();}
  }
  // 2. Delete ALL caches
  if('caches' in window){
    var names=await caches.keys();
    for(var n of names){await caches.delete(n);}
  }
  // 3. Clear sessionStorage/localStorage
  try{sessionStorage.clear();localStorage.clear();}catch(e){}
  // 4. Redirect to real app with cache-bust param
  window.location.replace('/?app=1&t='+Date.now());
})();
</script></body></html>`;

const LOG_FILE = path.join(__dirname, 'access.log');
fs.writeFileSync(LOG_FILE, ''); // clear log on start

const server = http.createServer((req, res) => {
  const url = req.url || '/';
  const urlPath = url.split('?')[0];
  const query = url.includes('?') ? url.split('?')[1] : '';

  // Log every request with timestamp
  const logLine = `[${new Date().toISOString()}] ${req.method} ${url} from ${req.headers['user-agent'] || 'unknown'}\n`;
  fs.appendFileSync(LOG_FILE, logLine);
  console.log(logLine.trim());

  // Serve empty SW to kill any old service worker
  if (urlPath === '/sw.js' || urlPath === '/service-worker.js') {
    res.writeHead(200, {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-store',
      'Clear-Site-Data': '"cache", "storage"',
    });
    res.end(EMPTY_SW);
    return;
  }

  // Root without ?app= param: serve cache-clearing page first
  if (urlPath === '/' && !query.includes('app=')) {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Clear-Site-Data': '"cache", "storage"',
    });
    res.end(CACHE_CLEAR_PAGE);
    return;
  }

  // Normal file serving
  let filePath = path.join(DIST, urlPath === '/' ? 'index.html' : urlPath);

  if (!fs.existsSync(filePath)) {
    filePath = path.join(DIST, 'index.html');
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  // No-cache for HTML
  if (ext === '.html' || ext === '') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Clear-Site-Data', '"cache", "storage"');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }

  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch (e) {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
