// Zero-dependency Node server: serves /public and stores guestbook wishes in wishes.json
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_FILE = path.join(__dirname, 'wishes.json');
const FLOWERS_FILE = path.join(__dirname, 'flowers.json');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

const readWishes = () => {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return []; }
};

const sendJSON = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
};

function handleApi(req, res) {
  if (req.method === 'GET') return sendJSON(res, 200, readWishes());

  if (req.method === 'POST') {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 5000) req.destroy(); // reject oversized bodies
    });
    req.on('end', () => {
      try {
        const { author, message } = JSON.parse(raw);
        const a = String(author || '').trim().slice(0, 40);
        const m = String(message || '').trim().slice(0, 400);
        if (!a || !m) return sendJSON(res, 400, { error: 'Add your name and a message.' });
        const wishes = readWishes();
        wishes.unshift({ author: a, message: m, date: new Date().toISOString() });
        fs.writeFileSync(DATA_FILE, JSON.stringify(wishes.slice(0, 200), null, 2));
        sendJSON(res, 201, wishes[0]);
      } catch {
        sendJSON(res, 400, { error: 'Could not read that message.' });
      }
    });
    return;
  }
  sendJSON(res, 405, { error: 'Method not allowed' });
}

function handleFlowers(req, res) {
  const read = () => { try { return JSON.parse(fs.readFileSync(FLOWERS_FILE, 'utf8')).count || 0; } catch { return 0; } };
  if (req.method === 'GET') return sendJSON(res, 200, { count: read() });
  if (req.method === 'POST') {
    const count = read() + 1;
    fs.writeFileSync(FLOWERS_FILE, JSON.stringify({ count }));
    return sendJSON(res, 201, { count });
  }
  sendJSON(res, 405, { error: 'Method not allowed' });
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const filePath = path.join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath);

  if (!filePath.startsWith(PUBLIC_DIR)) { // block path traversal
    res.writeHead(403); return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Page not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

http.createServer((req, res) => {
  if (req.url.startsWith('/api/wishes')) return handleApi(req, res);
  if (req.url.startsWith('/api/flowers')) return handleFlowers(req, res);
  serveStatic(req, res);
}).listen(PORT, () => console.log(`Card is live at http://localhost:${PORT}`));