const config = require('./config/env');
const buildApp = require('./app');
const userRepository = require('./repositories/user.repository');

const start = async () => {
  const app = buildApp();
  try {
    await userRepository.init();

    await app.listen({ port: config.port, host: config.host });
    app.log.info(`CJS server → http://${config.host}:${config.port}  [${config.env}]`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
