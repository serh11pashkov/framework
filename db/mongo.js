import fp from "fastify-plugin";
import mongoose from "mongoose";
import { createItemModel } from "./models/item.model.js";
import { setItemModel } from "../repositories/deviceRepository.js";

export const connectMongo = async ({ logger, MONGO_URL, MONGO_DB_NAME }) => {
  if (mongoose.connection.readyState === 1) {
    return createItemModel();
  }

  try {
    await mongoose.connect(MONGO_URL, {
      dbName: MONGO_DB_NAME,
    });

    const itemModel = createItemModel();
    setItemModel(itemModel);

    if (logger?.info) {
      logger.info("MongoDB connected");
    }

    return itemModel;
  } catch (error) {
    if (logger?.error) {
      logger.error(error, "MongoDB connection error");
    }

    process.exit(1);
  }
};

async function mongoPlugin(fastify) {
  const itemModel = await connectMongo({
    logger: fastify.log,
    MONGO_URL: fastify.config.MONGO_URL,
    MONGO_DB_NAME: fastify.config.MONGO_DB_NAME,
  });

  fastify.decorate("mongoose", mongoose);
  fastify.decorate("db", mongoose.connection);
  fastify.decorate("models", { Item: itemModel });

  fastify.addHook("onClose", async () => {
    await mongoose.connection.close();
    fastify.log.info("MongoDB connection closed");
  });
}

export default fp(mongoPlugin, { name: "mongo-plugin" });
