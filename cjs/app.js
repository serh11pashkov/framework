const fastify = require('fastify');
const apiRoutes = require('./routes/api.routes');

function buildApp() {
  const app = fastify({ logger: true });

  const config = require('./config/env');

  const errorHandler = require('./plugins/error-handler');
  app.register(errorHandler);

  app.get('/health', async () => ({ status: 'ok' }));

  app.register(apiRoutes.routes, { prefix: '/api' });
  return app;
}

module.exports = buildApp;
