import fastify from 'fastify';
import config from './config/env.js';
import errorHandler from './plugins/error-handler/index.js';
import apiRoutes from './routes/api.routes.js';

function buildApp() {
  const app = fastify({ logger: true });

  app.register(errorHandler);
  app.get('/health', async () => ({ status: 'ok' }));
  app.register(apiRoutes, { prefix: '/api' });

  return app;
}
export default buildApp;
