import {
  mysqlTable,
  int,
  varchar,
  text,
  timestamp,
} from "drizzle-orm/mysql-core";

export const items = mysqlTable("items", {
  id: int("id").autoincrement().primaryKey(),
  device: varchar("device", { length: 255 }).notNull(),
  status: varchar("status", { length: 10 }).notNull(),
  room: varchar("room", { length: 255 }).notNull(),
  description: text("description"),
  image: varchar("image", { length: 255 }),
  power: varchar("power", { length: 255 }),
});
