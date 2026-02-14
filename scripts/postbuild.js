#!/usr/bin/env node
/**
 * Post-build script: fixes dist/index.html after `expo export`
 * - Adds translate="no" to <html>
 * - Adds Google Translate suppression meta tags
 * - Adds cache-control meta tags
 * - Adds service worker cleanup script
 * - Adds loading indicator visible before React mounts
 * - Adds global error handler for uncaught errors
 * - Sets Japanese noscript text
 * - Copies dist/ to docs/ for GitHub Pages
 *
 * Usage: node scripts/postbuild.js
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const DOCS = path.join(__dirname, '..', 'docs');
const HTML_PATH = path.join(DIST, 'index.html');

if (!fs.existsSync(HTML_PATH)) {
  console.error('dist/index.html not found. Run `npx expo export --platform web` first.');
  process.exit(1);
}

let html = fs.readFileSync(HTML_PATH, 'utf-8');

// 1. Add translate="no" to <html> tag
html = html.replace('<html lang="ja">', '<html lang="ja" translate="no">');

// 2. Add meta tags after <meta charset="utf-8" />
const metaTags = `
    <meta name="google" content="notranslate" />
    <meta http-equiv="Cache-Control" content="no-store, no-cache, must-revalidate, max-age=0" />
    <meta http-equiv="Pragma" content="no-cache" />
    <meta http-equiv="Expires" content="0" />`;

html = html.replace(
  '<meta charset="utf-8" />',
  '<meta charset="utf-8" />' + metaTags
);

// 3. Fix httpEquiv (JSX prop name) to http-equiv (HTML attribute)
html = html.replace(/httpEquiv=/g, 'http-equiv=');

// 4. Add SW cleanup script before the <style> tag
const swScript = `
    <script>
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(r) {
          r.forEach(function(reg) { reg.unregister(); });
        });
      }
      if ('caches' in window) {
        caches.keys().then(function(n) {
          n.forEach(function(name) { caches.delete(name); });
        });
      }
    </script>`;

html = html.replace('<style id="expo-reset">', swScript + '\n    <style id="expo-reset">');

// 5. Add loading indicator inside <div id="root"> so it shows before React mounts
html = html.replace(
  '<div id="root"></div>',
  '<div id="root"><div id="loading" style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#F5F5F5"><div style="text-align:center"><p style="font-size:18px;color:#333;margin:0 0 8px">AI &#x30B9;&#x30B1;&#x30B8;&#x30E5;&#x30FC;&#x30E9;&#x30FC;</p><p style="font-size:14px;color:#999;margin:0">&#x8AAD;&#x307F;&#x8FBC;&#x307F;&#x4E2D;...</p></div></div></div>'
);

// 6. Add global error handler to catch uncaught JS errors and display them
const errorHandler = `
    <script>
      window.onerror = function(msg, src, line, col, err) {
        var root = document.getElementById('root');
        if (root) {
          root.innerHTML = '<div style="padding:20px;font-family:sans-serif;color:#D32F2F"><h2>\\u30A8\\u30E9\\u30FC\\u304C\\u767A\\u751F\\u3057\\u307E\\u3057\\u305F</h2><pre style="white-space:pre-wrap;font-size:12px;color:#333;background:#f5f5f5;padding:12px;border-radius:8px">' + msg + '\\n' + (src||'') + ':' + (line||'') + '</pre></div>';
        }
      };
    </script>`;
html = html.replace('</head>', errorHandler + '\n  </head>');

// 7. Fix noscript text
html = html.replace(
  /You need to enable JavaScript to run this app\./,
  'JavaScriptを有効にしてください。'
);

// 8. Convert absolute paths to relative for GitHub Pages subdir deployment
html = html.replace(/src="\//g, 'src="./');
html = html.replace(/href="\//g, 'href="./');

// 9. Clean up comments
html = html.replace(/\s*<!-- The `react-native-web`.*?-->/s, '');
html = html.replace(/\s*<!-- Use static rendering.*?-->/s, '');
html = html.replace(/\s*<!-- The root element.*?-->/s, '');
html = html.replace(/\s*\/\* These styles.*?\*\//g, '');

fs.writeFileSync(HTML_PATH, html);
console.log('dist/index.html patched successfully.');

// 10. Copy dist/ to docs/ for GitHub Pages
function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Clean docs/ except .nojekyll
if (fs.existsSync(DOCS)) {
  for (const entry of fs.readdirSync(DOCS, { withFileTypes: true })) {
    if (entry.name === '.nojekyll') continue;
    const p = path.join(DOCS, entry.name);
    fs.rmSync(p, { recursive: true, force: true });
  }
} else {
  fs.mkdirSync(DOCS);
}

copyDirSync(DIST, DOCS);

// Ensure .nojekyll exists
const nojekyll = path.join(DOCS, '.nojekyll');
if (!fs.existsSync(nojekyll)) fs.writeFileSync(nojekyll, '');

// Create 404.html (copy of index.html for SPA routing on GitHub Pages)
fs.copyFileSync(path.join(DOCS, 'index.html'), path.join(DOCS, '404.html'));

console.log('docs/ synced from dist/ successfully.');
