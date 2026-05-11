# Лабораторна робота №9 - Session-based Auth (Lab_9_Session)

## Тема
Session-based автентифікація з hешуванням паролів через argon2

## Мета
- Реалізувати session-based автентифікацію через @fastify/session
- Інтегрувати Redis як store для сесій
- Реалізувати хешування паролів через argon2
- Захистити маршрути за допомогою onRequest хуків
- Додати auth ендпоінти до Swagger документації

## Виконані завдання

### 1. Встановлення залежностей та конфігурація

**Встановлені пакети:**
```bash
npm install @fastify/redis @fastify/session @fastify/cookie fastify-session-redis-store argon2
```

**Оновлено .env та env.schema.js:**
- Додано `SESSION_SECRET` (мінімум 32 символи)
- Додано `REDIS_HOST` та `REDIS_PORT`
- Опціонально `REDIS_URL` для Redis Cloud

### 2. Регістрація плагінів у app.js

**Порядок реєстрації критичний:**
```javascript
// 1. Redis
const redisConfig = fastify.config.REDIS_URL
  ? { url: fastify.config.REDIS_URL }
  : {
      host: fastify.config.REDIS_HOST,
      port: fastify.config.REDIS_PORT,
    };
await fastify.register(fastifyRedis, {
  ...redisConfig,
  closeClient: true,
});

// 2. Cookie (перед Session)
await fastify.register(fastifyCookie);

// 3. Session з Redis store
await fastify.register(fastifySession, {
  secret: fastify.config.SESSION_SECRET,
  store: new RedisStore({ client: fastify.redis }),
  cookie: {
    httpOnly: true,
    secure: fastify.config.NODE_ENV === "production",
    maxAge: 86400000, // 24 години
  },
  saveUninitialized: false,
});

// 4. Rate limit (після Redis)
await fastify.register(fastifyRateLimit, {
  max: 100,
  timeWindow: "1 minute",
  redis: fastify.redis,
  ...
});
```

### 3. Auth Decorator

```javascript
// Перевіряє наявність userId в сесії
fastify.decorate("authenticate", async (request, reply) => {
  if (!request.session.userId) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
});
```

### 4. Таблиця Users (Drizzle ORM)

**db/schema.js:**
```javascript
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
```

**Міграція:**
```bash
npm run db:generate  # Генерує SQL
npm run db:migrate   # Застосовує в БД
```

### 5. Auth Service з Argon2

**services/authService.js:**
```javascript
import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { users } from "../db/schema.js";

export const createAuthService = ({ db } = {}) => {
  return {
    async register(email, password) {
      // 1. Перевірка унікальності email
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser.length > 0) {
        throw new Error("Email already registered");
      }

      // 2. Хешування паролю через argon2
      const hashedPassword = await argon2.hash(password);

      // 3. Збереження в БД
      const result = await db
        .insert(users)
        .values({
          email,
          password: hashedPassword,
        });

      // 4. Повернення без паролю
      return {
        id: result.insertId,
        email,
      };
    },

    async login(email, password) {
      // 1. Пошук користувача
      const userList = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (userList.length === 0) {
        throw new Error("Invalid credentials");
      }

      const user = userList[0];

      // 2. Верифікація паролю
      const isValid = await argon2.verify(user.password, password);
      if (!isValid) {
        throw new Error("Invalid credentials");
      }

      // 3. Повернення без паролю
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    },

    async getUserById(id) {
      // Отримання користувача по ID без паролю
      const userList = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (userList.length === 0) return null;

      const user = userList[0];
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    },
  };
};
```

### 6. Auth Ендпоінти

**routes/authRoutes.js:**

#### POST /auth/register
```javascript
// Запит:
{
  "email": "user@example.com",
  "password": "password123",
  "passwordConfirm": "password123"
}

// Відповідь 201:
{
  "id": 1,
  "email": "user@example.com"
}

// Помилка 400 (email існує):
{
  "error": "Email already registered"
}
```

#### POST /auth/login
```javascript
// Запит:
{
  "email": "user@example.com",
  "password": "password123"
}

// Відповідь 200:
{
  "id": 1,
  "email": "user@example.com"
}

// Помилка 401:
{
  "error": "Invalid credentials"
}

// Cookie встановляється автоматично!
// Set-Cookie: sessionId=... ; httpOnly; Secure (production)
```

#### POST /auth/logout (захищений)
```javascript
// Заголовок: Requires valid session cookie
// Відповідь 204: Сесія знищена
```

#### GET /auth/me (захищений)
```javascript
// Запит:
// Cookie: sessionId=...

// Відповідь 200:
{
  "id": 1,
  "email": "user@example.com",
  "createdAt": "2024-05-11T10:15:00Z"
}
```

### 7. Захист маршрутів

**routes/deviceRoutes.js:**
```javascript
// Публічні маршрути (без onRequest)
fastify.get("/items", { schema: { ... } }, ctrl.getDevices);
fastify.get("/items/:id", { schema: { ... } }, ctrl.getDeviceById);

// Захищені маршрути (з onRequest)
fastify.post(
  "/items",
  {
    onRequest: [fastify.authenticate], // ← Це!
    schema: { ... }
  },
  ctrl.createDevice
);

fastify.patch(
  "/items/:id",
  {
    onRequest: [fastify.authenticate],
    schema: { ... }
  },
  ctrl.patchDevice
);

fastify.delete(
  "/items/:id",
  {
    onRequest: [fastify.authenticate],
    schema: { ... }
  },
  ctrl.deleteDevice
);
```

**Захищені методи:**
- POST /api/v1/items
- POST /api/v1/devices
- PATCH /api/v1/items/:id
- PATCH /api/v1/devices/:id
- PUT /api/v1/items/:id
- PUT /api/v1/devices/:id
- DELETE /api/v1/items/:id
- DELETE /api/v1/devices/:id
- POST /api/v1/devices/import
- POST /api/v1/devices/:id/image

## Архітектурні рішення

### Session vs Token
- **Session:** Stateful (сервер зберігає стан), безпечне видалення (logout)
- **Cookie:** HttpOnly запобігає XSS, автоматично передається браузером
- **TTL:** 24 години (86400000 ms)

### Password Hashing
- **Argon2:** RFC 9106, переможець Password Hashing Competition 2015
- **Salt:** Унікальна для кожного паролю (генерується автоматично)
- **Параметри:** За замовчуванням OWASP-aligned

### Validation Schema

**schemas/auth.schema.js:**
```javascript
registerSchema = {
  email: "string (email format, 3-255)",
  password: "string (min 8, max 255)",
  passwordConfirm: "string (matching)"
}

loginSchema = {
  email: "string (email format, 3-255)",
  password: "string (min 1)"
}
```

## Тестування

### 1. Регістрація
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "passwordConfirm": "password123"
  }'

# Відповідь 201:
# {"id":1,"email":"test@example.com"}
```

### 2. Вхід та отримання Cookie
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }' -i

# Відповідь включає:
# Set-Cookie: sessionId=...; Path=/; HttpOnly
```

### 3. Перевірка поточного користувача
```bash
curl http://localhost:3000/auth/me \
  -H "Cookie: sessionId=..."

# 200: {"id":1,"email":"test@example.com","createdAt":"..."}
# 401: {"error":"Unauthorized"} (без cookie)
```

### 4. Тестування захисту маршрутів
```bash
# БЕЗ авторизації (повинна бути помилка 401)
curl -X POST http://localhost:3000/api/v1/items \
  -H "Content-Type: application/json" \
  -d '{"device":"Light","status":"on","room":"kitchen"}'
# 401: {"error":"Unauthorized"}

# З авторизацією (передати cookie)
curl -X POST http://localhost:3000/api/v1/items \
  -H "Content-Type: application/json" \
  -H "Cookie: sessionId=..." \
  -d '{"device":"Light","status":"on","room":"kitchen"}'
# 201: {"message":"Device added","device":{...}}
```

### 5. Тестування вихіду
```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Cookie: sessionId=..." -i

# 204 No Content
# Set-Cookie: sessionId=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly

# Наступний запит до /auth/me повинен повернути 401
```

### 6. Тестування валідації
```bash
# Невірний email
curl -X POST http://localhost:3000/auth/register \
  -d '{"email":"invalid","password":"pass"}'
# 400 Bad Request

# Короткий пароль
curl -X POST http://localhost:3000/auth/register \
  -d '{"email":"user@example.com","password":"short"}'
# 400 Bad Request
```

## Swagger документація

Auth ендпоінти додані до `/docs`:
- `POST /auth/register` - Регістрація (публічна)
- `POST /auth/login` - Вхід (публічна)
- `POST /auth/logout` - Вихід (захищена)
- `GET /auth/me` - Поточний користувач (захищена)

## Git Commit

```bash
git add .
git commit -m "Lab_9_Session: Session-based auth with argon2, protected routes, auth endpoints with Swagger"
git push origin Lab_9_Session
```

## Результати

✅ Redis сесії з TTL 24 години  
✅ Argon2 хешування паролів  
✅ Session-based автентифікація  
✅ HttpOnly cookies (захист від XSS)  
✅ Захист POST/PATCH/DELETE маршрутів  
✅ Валідація через JSON Schema  
✅ Auth ендпоінти в Swagger  
✅ Email унікальність  

## Наступні кроки
→ Lab_9_JWT: JWT-based автентифікація з access/refresh токенами
