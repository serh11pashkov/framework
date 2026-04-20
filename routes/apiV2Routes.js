import * as ctrl from "#controllers";

const paginationQuerySchema = {
  type: "object",
  properties: {
    page: { type: "integer", minimum: 1, default: 1 },
    limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
    room: { type: "string", minLength: 1 },
  },
  additionalProperties: false,
};

export async function apiV2Routes(fastify) {
  fastify.get(
    "/items",
    {
      schema: {
        tags: ["v2/items"],
        summary: "Get paginated items list",
        querystring: paginationQuerySchema,
      },
    },
    ctrl.getItemsV2,
  );

  fastify.get(
    "/github/shared-repos",
    {
      schema: {
        tags: ["v2/github"],
        summary: "Find top repositories with most shared contributors (v2)",
        querystring: {
          type: "object",
          required: ["repo"],
          properties: {
            repo: { type: "string", minLength: 3 },
          },
          additionalProperties: false,
        },
      },
    },
    ctrl.getSharedReposV2,
  );
}
