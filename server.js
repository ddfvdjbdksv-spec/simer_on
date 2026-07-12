const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = Number(process.env.PORT) || 4173;
const host = '127.0.0.1';

const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
    res.writeHead(status, {
        'Content-Type': type,
        'Cache-Control': 'no-store'
    });
    res.end(body);
}

const server = http.createServer((req, res) => {
    const cleanUrl = decodeURIComponent(req.url.split('?')[0]);
    const requestPath = cleanUrl === '/' ? '/index.html' : cleanUrl;
    const filePath = path.normalize(path.join(root, requestPath));

    if (!filePath.startsWith(root)) {
        send(res, 403, 'Forbidden');
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            send(res, 404, 'Not found');
            return;
        }

        const type = contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
        send(res, 200, data, type);
    });
});

server.listen(port, host, () => {
    console.log(`نظام إدارة الدروس is running at http://${host}:${port}`);
});
