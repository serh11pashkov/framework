import { Transform } from "stream";

export class SmartHomeStatusTransform extends Transform {
  constructor() {
    super({ objectMode: true });
  }

  _transform(item, _encoding, callback) {
    const status = String(item?.status ?? "").toLowerCase();
    callback(null, {
      ...item,
      isActive: status === "on",
    });
  }
}
