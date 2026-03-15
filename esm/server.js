import buildApp from './app.js';
import config from './config/env.js';
import * as userRepository from './repositories/user.repository.js';

const start = async () => {
  const app = buildApp();
  try {
    await userRepository.init();

    await app.listen({ port: config.port, host: config.host });
    app.log.info(`ESM server → http://${config.host}:${config.port}  [${config.env}]`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
