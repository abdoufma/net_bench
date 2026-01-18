#!/usr/bin/env node
// Minimal LAN file downloader (zero deps)
// Usage: node share.js --dir ./share --port 3000 --host 0.0.0.0

const http = require("http");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
function arg(name, def) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
}

const ROOT = path.resolve(arg("dir", process.cwd()));
const PORT = parseInt(arg("port", "3000"), 10);
const HOST = arg("host", "0.0.0.0");

// basic HTML escape
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

const server = http.createServer((req, res) => {
  // Only GET allowed
  if (req.method !== "GET") {
    res.writeHead(405, { "Content-Type": "text/plain" });
    return res.end("Method Not Allowed");
  }

  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  // Route: "/" -> list files; "/f/<name>" -> download file
  if (urlPath === "/") {
    fs.readdir(ROOT, { withFileTypes: true }, (err, entries) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        return res.end("Failed to read directory");
      }
      const files = entries.filter((e) => e.isFile()).map((e) => e.name).sort();
      const dirs  = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();

      const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Shared files</title>
<style>
  body{font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;}
  h1{font-size:20px;margin:0 0 16px}
  ul{padding-left:18px}
  code{background:#f2f2f2;padding:2px 6px;border-radius:4px}
  .muted{color:#666}
</style>
</head>
<body>
  <h1>Shared folder: <code>${esc(ROOT)}</code></h1>
  <p class="muted">Click a file to download. Only the top-level files are listed (no recursion).</p>
  ${dirs.length ? `<h3>Folders (not browsable):</h3><ul>${dirs.map(d=>`<li>${esc(d)}</li>`).join("")}</ul>` : ""}
  <h3>Files:</h3>
  <ul>
    ${files.length ? files.map(f => `<li><a href="/f/${encodeURIComponent(f)}" download>${esc(f)}</a></li>`).join("") : "<li><em>No files found</em></li>"}
  </ul>
</body>
</html>`;
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    });
    return;
  }

  // /f/<filename> -> force download
  if (urlPath.startsWith("/f/")) {
    const name = urlPath.slice(3);
    // Prevent path traversal
    const safePath = path.normalize(name).replace(/^(\.\.[/\\])+/, "");
    const abs = path.join(ROOT, safePath);

    // Ensure target stays inside ROOT
    if (!abs.startsWith(ROOT + path.sep)) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      return res.end("Invalid path");
    }

    fs.stat(abs, (err, st) => {
      if (err || !st.isFile()) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        return res.end("Not found");
      }
      res.writeHead(200, {
        // generic type + force download
        "Content-Type": "application/octet-stream",
        "Content-Length": st.size,
        "Content-Disposition": `attachment; filename="${path.basename(abs).replace(/"/g, '\\"')}"`
      });
      fs.createReadStream(abs).pipe(res);
    });
    return;
  }

  // Fallback
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.listen(PORT, HOST, () => {
  const ifaces = Object.values(require("os").networkInterfaces() || {}).flat().filter(i => i && !i.internal && i.family === "IPv4");
  const ips = ifaces.map(i => i.address);
  console.log(`📁 Sharing: ${ROOT}`);
  console.log(`🚀 Listening on http://${HOST === "0.0.0.0" ? (ips[0] || "your_LAN_IP") : HOST}:${PORT}`);
  console.log(`ℹ️  Open that URL from another machine on the same network.`);
});