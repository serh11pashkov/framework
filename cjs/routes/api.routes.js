const userController = require('../controllers/user.controller');
const { getStats } = require('../state/request-counter');

const getUserByIdSchema = {
  schema: {
    params: {
      type: 'object',
      properties: {
        id: { type: 'integer' }
      },
      required: ['id']
    }
  }
};

async function apiRoutes(fastify, options) {
  fastify.get('/users', userController.getUsers);
  fastify.get('/users/:id', getUserByIdSchema, userController.getUserById);

  fastify.get('/stats', async () => getStats());
}

module.exports = {
  routes: apiRoutes
};
