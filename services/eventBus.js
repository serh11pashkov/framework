import { EventEmitter } from "events";

export const APP_EVENTS = {
  ITEM_CHANGED: "item:changed",
};

export const eventBus = new EventEmitter();
