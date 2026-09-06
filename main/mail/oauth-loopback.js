const http = require("http");

function createOAuthLoopback({ callbackPath = "/oauth/callback", timeoutMs = 180000 } = {}) {
  let settle;
  const resultPromise = new Promise((resolve, reject) => {
    settle = { resolve, reject };
  });

  const server = http.createServer((req, res) => {
    let pathname = "/";
    try {
      pathname = new URL(req.url || "/", "http://127.0.0.1").pathname;
    } catch {
      res.writeHead(400);
      res.end("Bad request");
      return;
    }

    if (pathname !== callbackPath) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const url = new URL(req.url, "http://127.0.0.1");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    if (error) {
      const hint =
        error === "access_denied"
          ? "<p style='margin-top:1rem;line-height:1.5'>Add your Google account as a <strong>Test user</strong> in Google Cloud Console → Google Auth Platform → Audience → Test users, then try Connect again.</p>"
          : "";
      res.end(
        `<html><body style='font-family:system-ui;background:#0a0e14;color:#e8ecf1;padding:2rem;max-width:36rem'><h1>Connection failed</h1><p>${error}${errorDescription ? `: ${errorDescription}` : ""}</p>${hint}<p style='margin-top:1rem;color:#9aa4b2'>You can close this window.</p></body></html>`
      );
      const msg =
        error === "access_denied"
          ? "Google blocked sign-in (403 access_denied). Add your email as a Test user in Google Cloud Console → Audience → Test users, then try Connect again."
          : errorDescription || error;
      finish(new Error(msg));
      return;
    }

    res.end(
      "<html><body style='font-family:system-ui;background:#0a0e14;color:#e8ecf1;padding:2rem'><h1>My Space connected</h1><p>Return to My Space — this window will close.</p><script>setTimeout(()=>window.close(),800)</script></body></html>"
    );
    finish(null, { code, state });
  });

  let port = null;
  let timer = null;
  let closed = false;

  function finish(err, payload) {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    server.close(() => {
      if (err) settle.reject(err);
      else settle.resolve(payload);
    });
  }

  const ready = new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      port = server.address().port;
      timer = setTimeout(() => finish(new Error("OAuth timed out — try again")), timeoutMs);
      resolve({
        port,
        redirectUri: `http://127.0.0.1:${port}${callbackPath}`,
        waitForResult: () => resultPromise,
        cancel: () => finish(new Error("OAuth cancelled")),
      });
    });
  });

  return ready;
}

module.exports = { createOAuthLoopback };