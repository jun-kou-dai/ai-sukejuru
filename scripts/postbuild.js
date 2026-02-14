#!/usr/bin/env node
/**
 * Post-build script: fixes dist/index.html after `expo export`
 * - Adds translate="no" to <html>
 * - Adds Google Translate suppression meta tags
 * - Adds cache-control meta tags
 * - Adds service worker cleanup script
 * - Sets Japanese noscript text
 *
 * Usage: node scripts/postbuild.js
 */

const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(__dirname, '..', 'dist', 'index.html');

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

// 3. Add SW cleanup script before </head>
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

// Insert before the <style> tag
html = html.replace('<style id="expo-reset">', swScript + '\n    <style id="expo-reset">');

// 4. Fix noscript text
html = html.replace(
  /You need to enable JavaScript to run this app\./,
  'JavaScriptを有効にしてください。'
);

// 5. Clean up comments
html = html.replace(/\s*<!-- The `react-native-web`.*?-->/s, '');
html = html.replace(/\s*<!-- Use static rendering.*?-->/s, '');
html = html.replace(/\s*<!-- The root element.*?-->/s, '');
html = html.replace(/\s*\/\* These styles.*?\*\//g, '');

fs.writeFileSync(HTML_PATH, html);
console.log('dist/index.html patched successfully.');
