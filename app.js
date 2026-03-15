"use strict";

const { createServer } = require("node:http");
const config = require("#config");
const { logRequest } = require("#utils/logger");
const { router } = require("#routes");

const server = createServer(async (req, res) => {
  const method = req.method;
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = parsedUrl;

  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const send = (response, status, body) => {
    logRequest(method, pathname, status);
    response.statusCode = status;
    response.end(JSON.stringify(body));
  };

  try {
    await router(req, res, send, parsedUrl);
  } catch (err) {
    send(res, 400, { error: err.message || "Bad Request" });
  }
});

function gracefulShutdown(signal) {
  process.stdout.write(`[shutdown] ${signal} received\n`);
  const timer = setTimeout(() => {
    process.stderr.write("[shutdown] timeout — force exit 1\n");
    process.exit(1);
  }, 10_000).unref();

  server.close((err) => {
    clearTimeout(timer);
    if (err) {
      process.stderr.write(`[shutdown] error: ${err.message}\n`);
      process.exit(1);
    }
    process.stdout.write("[shutdown] closed — exit 0\n");
    process.exit(0);
  });
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("uncaughtException", (err) => {
  process.stderr.write(
    `${new Date().toISOString()} | ERROR | uncaughtException | ${err.stack}\n`,
  );
  gracefulShutdown("uncaughtException");
});
process.on("unhandledRejection", (reason) => {
  const msg = reason instanceof Error ? reason.stack : String(reason);
  process.stderr.write(
    `${new Date().toISOString()} | ERROR | unhandledRejection | ${msg}\n`,
  );
  gracefulShutdown("unhandledRejection");
});

server.listen(config.PORT, config.HOSTNAME, () => {
  console.log(`Server running at http://${config.HOSTNAME}:${config.PORT}/`);
  console.log("  GET    /health");
  console.log("  GET    /devices?room=Kitchen");
  console.log("  GET    /devices/:id");
  console.log("  POST   /devices");
  console.log("  PATCH  /devices/:id");
  console.log("  PUT    /devices/:id");
  console.log("  DELETE /devices/:id");
});
