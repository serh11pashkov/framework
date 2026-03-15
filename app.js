const { createServer } = require("node:http");
const config = require("./config");

// Варіант 5: Розумний дім (Smart Home Devices)
let DEVICES = [
  { id: 1, device: "Smart Lamp", status: "on", room: "Kitchen" },
  { id: 2, device: "Smart Thermostat", status: "off", room: "Living Room" },
  { id: 3, device: "Smart Lock", status: "on", room: "Entrance" },
  { id: 4, device: "Smart Camera", status: "on", room: "Kitchen" },
];

// лог запиту: ISO | LEVEL | METHOD | PATH | STATUS
function logRequest(method, url, statusCode) {
  const level =
    statusCode >= 500 ? "ERROR" : statusCode >= 400 ? "WARN" : "INFO";
  if (config.IS_DEV || statusCode >= 400) {
    process.stdout.write(
      `${new Date().toISOString()} | ${level} | ${method} | ${url} | ${statusCode}\n`,
    );
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  const method = req.method;
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  res.setHeader("Content-Type", "application/json; charset=utf-8");

  // обгортка щоб не дублювати логування
  const send = (status, body) => {
    logRequest(method, pathname, status);
    res.statusCode = status;
    res.end(JSON.stringify(body));
  };

  try {
    // GET /health — стан процесу
    if (method === "GET" && pathname === "/health") {
      return send(200, {
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      });
    }

    // GET /devices — Отримати список пристроїв
    // Фільтрація за кімнатою (?room=Kitchen)

    if (method === "GET" && pathname === "/devices") {
      const room = parsedUrl.searchParams.get("room");
      let results = [...DEVICES];

      if (room) {
        results = results.filter(
          (d) => d.room.toLowerCase() === room.toLowerCase(),
        );
      }

      res.statusCode = 200;
      return send(200, { count: results.length, items: results });
    }

    // GET /devices/:id — Отримати конкретний пристрій за id

    if (method === "GET" && pathname.match(/^\/devices\/\d+$/)) {
      const id = parseInt(pathname.split("/")[2]);
      const device = DEVICES.find((d) => d.id === id);

      if (!device) {
        return send(404, { error: "Device not found" });
      }

      return send(200, device);
    }

    // POST /devices — Додати новий пристрій
    // Обов'язкові поля: device, room

    if (method === "POST" && pathname === "/devices") {
      const data = await readBody(req);

      // Валідація вхідних даних
      if (
        !data.device ||
        typeof data.device !== "string" ||
        data.device.trim() === ""
      ) {
        return send(400, {
          error: "Field 'device' is required and must be a non-empty string",
        });
      }
      if (
        !data.room ||
        typeof data.room !== "string" ||
        data.room.trim() === ""
      ) {
        return send(400, {
          error: "Field 'room' is required and must be a non-empty string",
        });
      }
      if (data.status !== undefined && !["on", "off"].includes(data.status)) {
        return send(400, { error: "Field 'status' must be 'on' or 'off'" });
      }

      const lastId = DEVICES.length > 0 ? DEVICES[DEVICES.length - 1].id : 0;
      const newDevice = {
        id: lastId + 1,
        device: data.device.trim(),
        status: data.status || "off",
        room: data.room.trim(),
      };

      DEVICES.push(newDevice);
      return send(201, { message: "Device added", device: newDevice });
    }

    // PATCH /devices/:id — Часткове оновлення пристрою
    // Оновлення одного або декількох полів (крім id)

    if (method === "PATCH" && pathname.match(/^\/devices\/\d+$/)) {
      const id = parseInt(pathname.split("/")[2]);
      const index = DEVICES.findIndex((d) => d.id === id);

      if (index === -1) {
        return send(404, { error: "Device not found" });
      }

      const data = await readBody(req);

      if (Object.keys(data).length === 0) {
        return send(400, { error: "Request body cannot be empty" });
      }

      if (data.id !== undefined) {
        return send(400, { error: "Field 'id' cannot be changed" });
      }

      if (
        data.device !== undefined &&
        (typeof data.device !== "string" || data.device.trim() === "")
      ) {
        return send(400, {
          error: "Field 'device' must be a non-empty string",
        });
      }
      if (data.status !== undefined && !["on", "off"].includes(data.status)) {
        return send(400, { error: "Field 'status' must be 'on' or 'off'" });
      }
      if (
        data.room !== undefined &&
        (typeof data.room !== "string" || data.room.trim() === "")
      ) {
        return send(400, { error: "Field 'room' must be a non-empty string" });
      }

      const allowed = ["device", "status", "room"];
      const updates = {};
      for (const key of allowed) {
        if (data[key] !== undefined) updates[key] = data[key];
      }

      DEVICES[index] = { ...DEVICES[index], ...updates };
      return send(200, { message: "Device updated", device: DEVICES[index] });
    }

    // PUT /devices/:id — Повне оновлення пристрою
    // Всі поля обов'язкові (крім id)

    if (method === "PUT" && pathname.match(/^\/devices\/\d+$/)) {
      const id = parseInt(pathname.split("/")[2]);
      const index = DEVICES.findIndex((d) => d.id === id);

      if (index === -1) {
        return send(404, { error: "Device not found" });
      }

      const data = await readBody(req);

      if (data.id !== undefined) {
        return send(400, { error: "Field 'id' cannot be changed" });
      }

      // Валідація всіх обов'язкових полів
      if (
        !data.device ||
        typeof data.device !== "string" ||
        data.device.trim() === ""
      ) {
        return send(400, {
          error: "Field 'device' is required and must be a non-empty string",
        });
      }
      if (
        !data.room ||
        typeof data.room !== "string" ||
        data.room.trim() === ""
      ) {
        return send(400, {
          error: "Field 'room' is required and must be a non-empty string",
        });
      }
      if (!data.status || !["on", "off"].includes(data.status)) {
        return send(400, {
          error: "Field 'status' is required and must be 'on' or 'off'",
        });
      }

      const updatedDevice = {
        id: DEVICES[index].id,
        device: data.device.trim(),
        status: data.status,
        room: data.room.trim(),
      };

      DEVICES[index] = updatedDevice;
      return send(200, { message: "Device replaced", device: updatedDevice });
    }

    // DELETE /devices/:id — Видалити пристрій

    if (method === "DELETE" && pathname.match(/^\/devices\/\d+$/)) {
      const id = parseInt(pathname.split("/")[2]);
      const originalLength = DEVICES.length;
      DEVICES = DEVICES.filter((d) => d.id !== id);

      if (DEVICES.length < originalLength) {
        return send(200, { message: `Device with id=${id} deleted` });
      } else {
        return send(404, { error: "Device not found" });
      }
    }

    // 404 — маршрут не знайдено
    send(404, { error: "Route not found" });
  } catch (err) {
    send(400, { error: err.message || "Bad Request" });
  }
});

// graceful shutdown:
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
  console.log("Available endpoints:");
  console.log("  GET    /health           - Process health info");
  console.log(
    "  GET    /devices          - Get all devices (filter: ?room=Kitchen)",
  );
  console.log("  GET    /devices/:id      - Get device by ID");
  console.log("  POST   /devices          - Add new device");
  console.log("  PATCH  /devices/:id      - Partial update of device");
  console.log("  PUT    /devices/:id      - Full replacement of device");
  console.log("  DELETE /devices/:id      - Remove device");
});
