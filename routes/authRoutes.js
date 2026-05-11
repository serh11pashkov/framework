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

  // Login
  fastify.post(
    "/login",
    {
      schema: {
        tags: ["auth"],
        description: "Login user and create session",
        body: loginSchema,
        response: {
          200: {
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
        const user = await fastify.authService.login(email, password);
        request.session.userId = user.id;
        return reply.status(200).send(user);
      } catch (error) {
        if (error.message === "Invalid credentials") {
          return reply.status(401).send({ error: "Invalid credentials" });
        }
        throw error;
      }
    }
  );

  // Logout
  fastify.post(
    "/logout",
    {
      onRequest: [fastify.authenticate],
      schema: {
        tags: ["auth"],
        description: "Logout user and destroy session",
        response: {
          204: {
            type: "null",
          },
        },
      },
    },
    async (request, reply) => {
      await request.session.destroy();
      return reply.status(204).send();
    }
  );

  // Get current user
  fastify.get(
    "/me",
    {
      onRequest: [fastify.authenticate],
      schema: {
        tags: ["auth"],
        description: "Get current authenticated user",
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
      const user = await fastify.authService.getUserById(request.session.userId);
      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }
      return reply.send(user);
    }
  );
}
