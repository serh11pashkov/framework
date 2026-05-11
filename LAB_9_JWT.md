# Lab 9 JWT - JWT-Based Authentication

## Overview

This lab implements JWT (JSON Web Token) based authentication for the Smart Home API. Unlike session-based auth (Lab_9_Session), JWT uses stateless tokens that are verified on each request.

**Key Differences from Session Auth:**
- **Stateless**: No server-side session storage (except Redis for refresh tokens)
- **Scalable**: Works seamlessly in distributed systems
- **Token-based**: Authentication info encoded in the token itself
- **Two-tier tokens**: Access token (short-lived) + Refresh token (long-lived)

## Architecture

### JWT Plugin Registration (app.js)

```javascript
// JWT with blacklist support via Redis
await fastify.register(fastifyJwt, {
  secret: fastify.config.JWT_SECRET,
  sign: { expiresIn: "15m" },
  trusted: async (request, decodedToken) => {
    // Check if token is blacklisted (for logout support)
    if (!decodedToken.jti) return true;
    const isBlacklisted = await fastify.redis.get(
      `blacklist:${decodedToken.jti}`
    );
    return !isBlacklisted;
  },
});
```

**Configuration Details:**
- `secret`: JWT_SECRET from environment (32+ chars minimum, non-production: "super-secret-key-at-least-32-chars-long")
- `sign: { expiresIn: "15m" }`: Default expiration for access tokens (15 minutes)
- `trusted` callback: Checks Redis blacklist for revoked tokens (enables logout)

### Auth Decorator - verifyJwt

```javascript
async function verifyJwt(request, reply) {
  try {
    await request.jwtVerify();
  } catch (error) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
}

fastify.decorate("verifyJwt", verifyJwt);
```

**Used in routes as:**
```javascript
fastify.get("/me", {
  onRequest: [fastify.verifyJwt],
  // ... handler
});
```

## Token Management

### Access Token (15-minute TTL)

Short-lived token sent in response body after login. Used in Authorization header for all protected requests.

```javascript
const jti = randomUUID(); // Unique ID for individual revocation
const accessToken = await reply.jwtSign(
  { sub: user.id, email: user.email, jti },
  { expiresIn: "15m" }
);
```

**Token Payload:**
```json
{
  "sub": 1,
  "email": "user@example.com",
  "jti": "550e8400-e29b-41d4-a716-446655440000",
  "iat": 1705244469,
  "exp": 1705245369
}
```

### Refresh Token (7-day TTL)

Long-lived token stored in httpOnly cookie and Redis. Used to obtain new access tokens without re-entering password.

```javascript
const refreshToken = await reply.jwtSign(
  { sub: user.id, email: user.email, type: "refresh" },
  { expiresIn: "7d" }
);

// Store in Redis for revocation support
await fastify.redis.set(
  `refresh:${user.id}`,
  refreshToken,
  "EX",
  604800 // 7 days
);

// Set httpOnly cookie (immune to XSS attacks)
reply.setCookie("refreshToken", refreshToken, {
  httpOnly: true,
  secure: fastify.config.NODE_ENV === "production",
  sameSite: "strict",
  path: "/auth/refresh",
  maxAge: 604800000, // 7 days
});
```

**Why Two Tokens?**
1. **Access Token** in response body → Can be used immediately in Authorization header
2. **Refresh Token** in httpOnly cookie → Protected from XSS, survives page reloads, used to get new access tokens when expired

## Authentication Endpoints

### 1. POST /auth/register

Create new user account.

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123",
    "passwordConfirm": "SecurePass123"
  }'
```

**Response (201 Created):**
```json
{
  "id": 1,
  "email": "user@example.com",
  "createdAt": "2024-01-15T14:21:09.000Z"
}
```

**Validation Rules:**
- Email: Valid email format, 3-255 chars, must be unique
- Password: Minimum 8 characters, hashed with argon2
- Password fields must match

### 2. POST /auth/login

Authenticate user, receive access token + refresh token.

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123"
  }'
```

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsImpqdCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMCIsImlhdCI6MTcwNTI0NDQ2OSwiZXhwIjoxNzA1MjQ1MzY5fQ.Xj9Z..."
}
```

**Side Effects:**
- Sets `refreshToken` cookie (httpOnly, secure, sameSite: strict)
- Stores refresh token in Redis at `refresh:${user.id}`

**Error Responses:**
- 401 Unauthorized: Invalid email or password
- 400 Bad Request: Schema validation error

### 3. POST /auth/refresh

Get new access token using refresh token from cookie.

```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Cookie: refreshToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsImpqdCI6Im5ldy1qdGktdmFsdWUiLCJpYXQiOjE3MDUyNDQ1MjksImV4cCI6MTcwNTI0NTQyOX0.Xj9Z..."
}
```

**Validation:**
- Refresh token must be present in cookie
- Token signature verified
- Token not expired
- Token still stored in Redis (not revoked)

**Error Responses:**
- 401 Unauthorized: Missing, expired, or revoked refresh token

### 4. POST /auth/logout

Invalidate tokens - blacklist access token, revoke refresh token.

```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Cookie: refreshToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response (204 No Content):**
Empty response body

**Side Effects:**
1. **Blacklist access token** → Stores `blacklist:${jti}` in Redis with TTL until token expiration
   - Prevents token reuse if leaked
   - TTL automatically removes stale entries
   
2. **Revoke refresh token** → Deletes `refresh:${user.id}` from Redis
   - Refresh endpoint will reject the token
   
3. **Clear cookie** → Removes `refreshToken` cookie from client

**Error Responses:**
- 401 Unauthorized: Missing or invalid access token

### 5. GET /auth/me

Get current authenticated user info.

```bash
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsImpqdCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMCIsImlhdCI6MTcwNTI0NDQ2OSwiZXhwIjoxNzA1MjQ1MzY5fQ.Xj9Z..."
```

**Response (200 OK):**
```json
{
  "id": 1,
  "email": "user@example.com",
  "createdAt": "2024-01-15T14:21:09.000Z"
}
```

**Error Responses:**
- 401 Unauthorized: Missing or invalid access token
- 404 Not Found: User ID from token doesn't exist in database

## Protected Routes

All mutation endpoints (POST, PATCH, PUT, DELETE) require valid JWT access token:

```javascript
onRequest: [fastify.verifyJwt]
```

### Example: Create Item (Protected)

```bash
curl -X POST http://localhost:3000/api/v2/items \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "device": "Light",
    "status": "on",
    "room": "Living Room",
    "description": "Main ceiling light"
  }'
```

**Error Response (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

### List Items (Public)

GET endpoints remain public (no authentication required):

```bash
curl http://localhost:3000/api/v2/items
```

## Implementation Files

### app.js
- JWT plugin registration with blacklist check
- verifyJwt hook for route protection
- authService DI

### routes/authRoutes.js
- POST /auth/register
- POST /auth/login
- POST /auth/refresh
- POST /auth/logout
- GET /auth/me

### services/authService.js
- register(email, password)
- login(email, password)
- getUserById(id)

### Redis Keys
```javascript
REDIS_KEYS: {
  // Refresh tokens (for revocation)
  "refresh:${user.id}": "<refreshToken>",
  
  // Blacklist for logout
  "blacklist:${jti}": "1",
  
  // Cache (from Lab 9 Redis)
  "cache:api:v2:items:page=${page}:limit=${limit}:room=${room}": {...},
  "cache:reference:deviceTypes": {...}
}
```

## Security Features

### 1. JWT Signature Verification
- Fastify @fastify/jwt automatically verifies token signature
- Invalid signatures rejected before reaching route handler
- Secret key never exposed in token (HMAC algorithm)

### 2. Token Expiration
- **Access token**: 15 minutes → Requires refresh for extended sessions
- **Refresh token**: 7 days → Provides acceptable user experience
- Expired tokens rejected by Fastify before reaching trusted callback

### 3. Blacklist on Logout
```javascript
// Store jti in Redis with TTL until token expiration
await fastify.redis.set(`blacklist:${jti}`, "1", "EX", ttl);

// Trusted callback rejects blacklisted tokens
trusted: async (request, decodedToken) => {
  if (!decodedToken.jti) return true;
  const isBlacklisted = await fastify.redis.get(`blacklist:${decodedToken.jti}`);
  return !isBlacklisted;
}
```

### 4. Password Hashing
- argon2 with auto-generated salt
- OWASP-compliant parameters
- Verified on login, never returned in API responses

### 5. httpOnly Cookies
- Refresh token stored in httpOnly cookie
- Immune to XSS attacks (JavaScript can't access)
- Automatic transmission with requests to `/auth/refresh`
- Secure flag on production (HTTPS only)

### 6. CORS & CSRF Protection
- @fastify/helmet for CORS headers
- sameSite: "strict" on refresh cookie
- @fastify/cors for cross-origin control

## Token Refresh Flow

### Scenario: Access Token Expires

**User's Access Token** (15 min):
```
GET /api/v2/items
Authorization: Bearer <expiredAccessToken>
```

**Server Response:**
```
401 Unauthorized
```

**Client Implementation (JavaScript):**
```javascript
// 1. Detect 401 response
if (response.status === 401) {
  // 2. Call refresh endpoint (refreshToken cookie sent automatically)
  const refreshResponse = await fetch('/auth/refresh', {
    method: 'POST',
    credentials: 'include' // Sends cookies
  });
  
  if (refreshResponse.ok) {
    const { accessToken } = await refreshResponse.json();
    
    // 3. Store new access token and retry request
    localStorage.setItem('accessToken', accessToken);
    
    const retryResponse = await fetch('/api/v2/items', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
  }
}
```

## Environment Configuration

### .env File
```bash
# JWT Secret (minimum 32 characters, non-alphanumeric recommended)
JWT_SECRET=super-secret-key-at-least-32-chars-long

# Redis Configuration
REDIS_URL=redis://default:PASSWORD@redis-host:6379
# OR for local development
REDIS_HOST=localhost
REDIS_PORT=6379

# Database
DATABASE_URL=mysql://user:password@localhost:3306/smart_home_drizzle

# Node Environment
NODE_ENV=development
```

### env.schema.js
```javascript
export const envSchema = {
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters")
    .default("super-secret-key-at-least-32-chars-long"),
  // ... other configs
};
```

## Testing Endpoints with Postman

### Test Sequence

1. **Register User**
   ```
   POST http://localhost:3000/auth/register
   Body (raw, JSON):
   {
     "email": "test@example.com",
     "password": "TestPassword123",
     "passwordConfirm": "TestPassword123"
   }
   ```

2. **Login User**
   ```
   POST http://localhost:3000/auth/login
   Body (raw, JSON):
   {
     "email": "test@example.com",
     "password": "TestPassword123"
   }
   Response includes accessToken, refreshToken cookie set automatically
   ```

3. **Save Access Token**
   - Copy accessToken from response
   - In Postman: Setup → Variables → Create `accessToken`
   - Paste value

4. **Test Protected Route**
   ```
   POST http://localhost:3000/api/v2/items
   Headers:
     Authorization: Bearer {{accessToken}}
   Body (raw, JSON):
   {
     "device": "Light",
     "status": "on",
     "room": "Bedroom"
   }
   ```

5. **Refresh Access Token**
   ```
   POST http://localhost:3000/auth/refresh
   Cookies automatically sent: refreshToken
   Response includes new accessToken
   ```

6. **Logout**
   ```
   POST http://localhost:3000/auth/logout
   Headers:
     Authorization: Bearer {{accessToken}}
   Cookies automatically sent: refreshToken
   Response: 204 No Content
   ```

7. **Verify Logout**
   ```
   GET http://localhost:3000/auth/me
   Headers:
     Authorization: Bearer {{accessToken}}
   Response: 401 Unauthorized (token blacklisted)
   ```

## Comparison: Session vs JWT vs OAuth2

| Aspect | Session | JWT | OAuth2 |
|--------|---------|-----|--------|
| Storage | Server-side (Redis) | Client-side (token) | Authorization server |
| Scalability | Limited by storage | Excellent | Excellent |
| Logout | Instant (delete session) | Token blacklist required | Token revocation endpoint |
| CSRF | Required (SameSite cookie) | Not vulnerable (Authorization header) | Not vulnerable |
| XSS | Vulnerable if in localStorage | Vulnerable if in localStorage | Vulnerable if in localStorage |
| Token Size | N/A | Larger (contains claims) | Medium |
| Revocation | Instant | Delayed (blacklist check on request) | Instant (revocation endpoint) |
| Server Load | Higher (session lookups) | Lower (signature verification) | None (3rd party) |

## Common Issues & Solutions

### Issue: Token Rejected with "Unauthorized"

**Possible Causes:**
1. Token expired
   - Solution: Use /auth/refresh to get new token
   
2. Token blacklisted
   - Solution: Need to login again
   
3. Invalid Authorization header
   - Solution: Use `Authorization: Bearer <token>` format (space between "Bearer" and token)
   
4. Invalid JWT Secret
   - Solution: Ensure JWT_SECRET in .env matches server config
   
5. Token signature invalid
   - Solution: Token may be corrupted or from different server instance

### Issue: Refresh Token Not Working

**Possible Causes:**
1. Cookie not being sent
   - Solution: In client/Postman, enable "Cookie" jar and use credentials: 'include'
   
2. Refresh token expired
   - Solution: Login again
   
3. Refresh token revoked
   - Solution: Login again (redis key deleted)

### Issue: CORS Error on /auth/refresh

**Solution:**
- Ensure @fastify/cors registered before auth routes
- Check credentials: 'include' on client-side request
- Ensure SameSite policy allows cookie transmission

## Next Steps

- Implement OAuth2 authentication for third-party integrations
- Add API key authentication for service-to-service communication
- Implement multi-factor authentication (MFA)
- Add password reset flow
- Implement role-based access control (RBAC)
