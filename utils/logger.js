"use strict";

const config = require("#config");

function logRequest(method, url, statusCode) {
  const level =
    statusCode >= 500 ? "ERROR" : statusCode >= 400 ? "WARN" : "INFO";
  if (config.IS_DEV || statusCode >= 400) {
    process.stdout.write(
      `${new Date().toISOString()} | ${level} | ${method} | ${url} | ${statusCode}\n`,
    );
  }
}

module.exports = { logRequest };
