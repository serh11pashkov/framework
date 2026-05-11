# Лабораторна робота №9 - Redis (Lab_9_Redis)

## Тема
Інтеграція Redis у Fastify-застосунок для кешування та обмеження частоти запитів

## Мета
- Встановити та інтегрувати Redis через плагін @fastify/redis
- Реалізувати кешування даних з TTL
- Перенести rate limiting на Redis store
- Додати таблицю users до бази даних
- Реалізувати інвалідацію кешу при мутаціях

## Виконані завдання

### 1. Встановлення @fastify/redis та конфігурація

**Встановлені пакети:**
```bash
npm install @fastify/redis ioredis
```

**Регістрація плагіну в app.js:**
```javascript
import fastifyRedis from "@fastify/redis";

// Умовна конфігурація для Redis Cloud та локального Redis
const redisConfig = fastify.config.REDIS_URL
  ? { url: fastify.config.REDIS_URL }
  : {
      host: fastify.config.REDIS_HOST,
      port: fastify.config.REDIS_PORT,
    };

await fastify.register(fastifyRedis, {
  ...redisConfig,
  closeClient: true, // Закрити з'єднання при завершенні сервера
});
```

**Змінні середовища (.env):**
```
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL=redis://default:PASSWORD@redis-XXXXX.c10.us-east-1-2.ec2.cloud.redislabs.com:XXXXX
```

**Схема валідації (schemas/env.schema.js):**
```javascript
export const envSchema = {
  type: "object",
  required: ["REDIS_HOST", "REDIS_PORT", ...],
  properties: {
    REDIS_URL: { type: "string", minLength: 1 },
    REDIS_HOST: { type: "string", minLength: 1 },
    REDIS_PORT: { type: "string", pattern: "^[0-9]+$" },
    ...
  },
};
```

### 2. Централізовані константи Redis ключів

**constants/index.js:**
```javascript
export const REDIS_KEYS = {
  ITEMS_LIST: (page = 1, limit = 10, room = "*") =>
    `cache:api:v2:items:page=${page}:limit=${limit}:room=${room}`,
  ITEMS_BY_ID: (id) => `cache:api:v2:items:${id}`,
  DEVICE_TYPES: "cache:reference:deviceTypes",
};
```

### 3. Dependency Injection - Device Service

**services/deviceService.js - Фабрична функція з DI:**
```javascript
export const createDeviceService = ({ redis } = {}) => {
  return {
    async getDevicesPaginated({ page = 1, limit = 10, room } = {}) {
      const cacheKey = REDIS_KEYS.ITEMS_LIST(page, limit, room || "*");

      // Перевірка кешу
      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      }

      // Отримання з БД
      const all = await repo.getAll();
      const filtered = room
        ? all.filter((d) => d.room.toLowerCase() === room.toLowerCase())
        : all;

      const result = {
        items: filtered.slice(...),
        total: filtered.length,
        page,
        limit,
        totalPages: Math.ceil(filtered.length / limit),
      };

      // Кешування на 24 години
      if (redis) {
        await redis.set(cacheKey, JSON.stringify(result), "EX", 86400);
      }

      return result;
    },

    async invalidateItemsCache() {
      if (!redis) return;
      const pattern = REDIS_KEYS.ITEMS_LIST("*", "*", "*");
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    },
  };
};
```

**app.js - Декоратор з DI:**
```javascript
import { createDeviceService } from "./services/deviceService.js";

fastify.decorate(
  "deviceService",
  createDeviceService({ redis: fastify.redis })
);
```

### 4. Заміна файлового кешу на Redis

**Раніше (Lab_6):**
- Кеш в файлі `data/cache/reference.json` (постійний)

**Тепер (Lab_9_Redis):**
```javascript
// services/deviceService.js
const getExternalDeviceTypes = async () => {
  if (!redis) return await fetchWithRetry(EXTERNAL_BASE_URL);

  const cacheKey = REDIS_KEYS.DEVICE_TYPES;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const fetched = await fetchWithRetry(EXTERNAL_BASE_URL);
  // TTL: 120 секунд
  await redis.set(cacheKey, JSON.stringify(fetched), "EX", 120);
  return fetched;
};
```

### 5. Rate Limiting на Redis Store

**app.js - Порядок реєстрації критичний!**
```javascript
// 1. Redis СПОЧАТКУ
await fastify.register(fastifyRedis, { ... });

// 2. Rate Limit ПОТІМ
await fastify.register(fastifyRateLimit, {
  max: 100,
  timeWindow: "1 minute",
  redis: fastify.redis, // ← Використовує Redis як store
  errorResponseBuilder: () => ({
    statusCode: 429,
    error: "Too Many Requests",
    message: "Rate limit exceeded, retry later",
  }),
});
```

### 6. Таблиця Users (Drizzle ORM)

**db/schema.js:**
```javascript
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
```

**Міграція (drizzle/0002_slow_turbo.sql):**
```sql
CREATE TABLE `users` (
  `id` int AUTO_INCREMENT NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `created_at` timestamp DEFAULT (now()),
  CONSTRAINT `users_id` PRIMARY KEY(`id`),
  CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
```

**Команди:**
```bash
npm run db:generate  # Генерує міграцію
npm run db:migrate   # Застосовує в БД
```

### 7. Кешування GET /api/v2/items (24 години)

**Ключ кешу враховує пагінацію:**
```
cache:api:v2:items:page=1:limit=10:room=*
cache:api:v2:items:page=2:limit=20:room=bedroom
cache:api:v2:items:page=1:limit=10:room=kitchen
```

**controllers/deviceController.js:**
```javascript
export async function createDevice(request, reply) {
  const device = await request.server.deviceService.createDevice(request.body);
  device.image = getFullImageUrl(request, device.image);
  // Інвалідація кешу після створення
  await request.server.deviceService.invalidateItemsCache();

  eventBus.emit(APP_EVENTS.ITEM_CHANGED, { event: "created", data: device });
  return reply.status(201).send({ message: MESSAGES.CREATED, device });
}

export async function patchDevice(request, reply) {
  const device = await request.server.deviceService.patchDevice(
    request.params.id,
    request.body
  );
  device.image = getFullImageUrl(request, device.image);
  // Інвалідація кешу після оновлення
  await request.server.deviceService.invalidateItemsCache();

  eventBus.emit(APP_EVENTS.ITEM_CHANGED, { event: "updated", data: device });
  return reply.send({ message: MESSAGES.UPDATED, device });
}

export async function deleteDevice(request, reply) {
  const deleted = await request.server.deviceService.deleteDevice(
    request.params.id
  );
  if (!deleted) throw reply.notFound(MESSAGES.NOT_FOUND);
  // Інвалідація кешу після видалення
  await request.server.deviceService.invalidateItemsCache();

  eventBus.emit(APP_EVENTS.ITEM_CHANGED, { event: "deleted", id: request.params.id });
  return reply.status(204).send();
}
```

## Архітектурні рішення

### Dependency Injection
- Сервіси отримують залежності через фабричні функції
- Redis передається під час ініціалізації, не під час імпорту
- Сервіси тестовані та незалежні від Fastify

### Centralized Cache Keys
- Всі ключи визначені в одному місці (`constants/index.js`)
- Зменшує ризик typo та забезпечує консистентність
- Полегшує перейменування та рефакторинг

### Explicit Cache Invalidation
- При мутаціях (POST, PATCH, DELETE) явно видаляються ключі кешу
- TTL є резервним механізмом, не основним
- Гарантує актуальність даних

## Тестування

### 1. Перевірка підключення Redis
```bash
# Terminal 1: Start server
npm run start

# Terminal 2: Connect to Redis
redis-cli PING  # → PONG

# Check Redis keys
redis-cli KEYS "cache:*"
```

### 2. Тестування кешування GET /api/v2/items

```bash
# Перший запит (з БД)
curl http://localhost:3000/api/v2/items?page=1&limit=10
# Перевірити Redis:
redis-cli GET "cache:api:v2:items:page=1:limit=10:room=*"

# Другий запит (з кешу)
curl http://localhost:3000/api/v2/items?page=1&limit=10
# Повинен вернути ту ж саму відповідь миттєво

# Інший параметр пагінації (новий ключ)
curl http://localhost:3000/api/v2/items?page=2&limit=20
redis-cli GET "cache:api:v2:items:page=2:limit=20:room=*"
```

### 3. Тестування інвалідації кешу

```bash
# Створити пристрій (видаляє ВСІ ключи cache:api:v2:items:*)
curl -X POST http://localhost:3000/api/v1/items \
  -H "Content-Type: application/json" \
  -d '{"device":"Light","status":"on","room":"living_room"}'

# Перевірити, що кеш видалений
redis-cli KEYS "cache:api:v2:items:*"  # → (empty list)

# Повторний запит до GET /api/v2/items повинен запитати БД знову
curl http://localhost:3000/api/v2/items?page=1&limit=10
```

### 4. Тестування Rate Limiting

```bash
# Відправити 100+ запитів
for i in {1..101}; do
  curl http://localhost:3000/api/v2/items 2>/dev/null
done

# 101-й запит повинен повернути 429 Too Many Requests
# Лічильник зберігається в Redis (не in-memory)
```

## Git Commit

```bash
git add .
git commit -m "Lab_9_Redis: Redis integration, caching, DI, users table"
git push origin Lab_9_Redis
```

## Результаты

✅ Redis інтегрований з підтримкою Redis Cloud  
✅ Dependency Injection для сервісів  
✅ Кешування GET /api/v2/items (24 години) з врахуванням пагінації  
✅ Інвалідація кешу при мутаціях  
✅ Rate limiting на Redis store (розподілена система)  
✅ Таблиця users в БД  
✅ Файловий кеш заміненений на Redis  

## Наступні кроки
→ Lab_9_Session: Session-based автентифікація з @fastify/session
→ Lab_9_JWT: JWT-based автентифікація з access/refresh токенами
