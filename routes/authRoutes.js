import { randomUUID } from "node:crypto";
import { registerSchema, loginSchema } from "../schemas/auth.schema.js";

export default async function authRoutes(fastify) {
  // Register
  fastify.post(
    "/register",
    {
      schema: {
        tags: ["auth"],
        description: "Register a new user",
        body: registerSchema,
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "number" },
              email: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;

      try {
        const user = await fastify.authService.register(email, password);
        return reply.status(201).send(user);
      } catch (error) {
        if (error.message === "Email already registered") {
          return reply.status(400).send({ error: "Email already registered" });
        }
        throw error;
      }
    }
  );

  // Login - returns access token + refresh token in cookie
  fastify.post(
    "/login",
    {
      schema: {
        tags: ["auth"],
        description: "Login user and receive access token + refresh token cookie",
        body: loginSchema,
        response: {
          200: {
            type: "object",
            properties: {
              accessToken: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;

      try {
        const user = await fastify.authService.login(email, password);

        // Generate tokens with jti (JWT ID) for blacklist support
        const jti = randomUUID();
        const accessToken = await reply.jwtSign(
          { sub: user.id, email: user.email, jti },
          { expiresIn: "15m" }
        );

        const refreshToken = await reply.jwtSign(
          { sub: user.id, email: user.email, type: "refresh" },
          { expiresIn: "7d" }
        );

        // Store refresh token in Redis for validation/revocation
        await fastify.redis.set(
          `refresh:${user.id}`,
          refreshToken,
          "EX",
          604800 // 7 days
        );

        // Set refresh token in httpOnly cookie
        reply.setCookie("refreshToken", refreshToken, {
          httpOnly: true,
          secure: fastify.config.NODE_ENV === "production",
          sameSite: "strict",
          path: "/auth/refresh",
          maxAge: 604800000, // 7 days
        });

        return reply.status(200).send({ accessToken });
      } catch (error) {
        if (error.message === "Invalid credentials") {
          return reply.status(401).send({ error: "Invalid credentials" });
        }
        throw error;
      }
    }
  );

  // Refresh - issue new access token using refresh token from cookie
  fastify.post(
    "/refresh",
    {
      schema: {
        tags: ["auth"],
        description:
          "Refresh access token using refresh token from cookie",
        response: {
          200: {
            type: "object",
            properties: {
              accessToken: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const refreshToken = request.cookies.refreshToken;

      if (!refreshToken) {
        return reply.status(401).send({ error: "Refresh token missing" });
      }

      try {
        // Verify refresh token
        const decoded = await fastify.jwt.verify(refreshToken);

        // Check if stored in Redis (not revoked)
        const storedToken = await fastify.redis.get(
          `refresh:${decoded.sub}`
        );
        if (!storedToken || storedToken !== refreshToken) {
          return reply.status(401).send({ error: "Invalid refresh token" });
        }

        // Issue new access token
        const jti = randomUUID();
        const newAccessToken = await reply.jwtSign(
          { sub: decoded.sub, email: decoded.email, jti },
          { expiresIn: "15m" }
        );

        return reply.status(200).send({ accessToken: newAccessToken });
      } catch (error) {
        return reply.status(401).send({ error: "Invalid refresh token" });
      }
    }
  );

  // Logout - blacklist access token and revoke refresh token
  fastify.post(
    "/logout",
    {
      onRequest: [fastify.verifyJwt],
      schema: {
        tags: ["auth"],
        description:
          "Logout user - blacklist access token and revoke refresh token",
        response: {
          204: {
            type: "null",
          },
        },
      },
    },
    async (request, reply) => {
      const { jti, sub, exp } = request.user;

      // Blacklist access token (store jti with TTL until expiration)
      if (jti && exp) {
        const currentTime = Math.floor(Date.now() / 1000);
        if (exp > currentTime) {
          const ttl = exp - currentTime;
          await fastify.redis.set(`blacklist:${jti}`, "1", "EX", ttl);
        }
      }

      // Revoke refresh token
      await fastify.redis.del(`refresh:${sub}`);

      // Clear cookie
      reply.clearCookie("refreshToken", { path: "/auth/refresh" });

      return reply.status(204).send();
    }
  );

  // Get current user - requires valid access token
  fastify.get(
    "/me",
    {
      onRequest: [fastify.verifyJwt],
      schema: {
        tags: ["auth"],
        description: "Get current authenticated user info",
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "number" },
              email: { type: "string" },
              createdAt: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = await fastify.authService.getUserById(request.user.sub);
      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }
      return reply.send(user);
    }
  );
}
