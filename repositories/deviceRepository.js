let repository = null;

const ensureRepository = () => {
  if (!repository) {
    throw new Error("Device repository is not initialized");
  }

  return repository;
};

const normalizeDevice = (device) => {
  if (!device) return null;

  return {
    id: Number(device.id),
    device: device.device,
    status: device.status,
    room: device.room,
    description: device.description ?? "",
    image: device.image ?? null,
    power: device.power ?? null,
  };
};

export const setDeviceRepository = (repo) => {
  repository = repo;
};

export const createDeviceRepository = (pool) => ({
  async getAll() {
    const [rows] = await pool.query(
      "SELECT id, device, status, room, description, image, power FROM items ORDER BY id ASC",
    );
    return rows.map(normalizeDevice);
  },

  async *iterateAll() {
    const [rows] = await pool.query(
      "SELECT id, device, status, room, description, image, power FROM items ORDER BY id ASC",
    );

    for (const row of rows) {
      yield normalizeDevice(row);
    }
  },

  async getById(id) {
    const [rows] = await pool.execute(
      "SELECT id, device, status, room, description, image, power FROM items WHERE id = ? LIMIT 1",
      [id],
    );
    return normalizeDevice(rows[0] ?? null);
  },

  async create(data) {
    const payload = {
      device: data.device,
      status: data.status ?? "off",
      room: data.room,
      description: data.description ?? "",
      image: data.image ?? null,
      power: data.power ?? null,
    };

    const [result] = await pool.execute(
      "INSERT INTO items (device, status, room, description, image, power) VALUES (?, ?, ?, ?, ?, ?)",
      [
        payload.device,
        payload.status,
        payload.room,
        payload.description,
        payload.image,
        payload.power,
      ],
    );

    return normalizeDevice({ id: result.insertId, ...payload });
  },

  async update(id, updates) {
    const allowedFields = [
      "device",
      "status",
      "room",
      "description",
      "image",
      "power",
    ];
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      return this.getById(id);
    }

    values.push(id);
    await pool.execute(
      `UPDATE items SET ${fields.join(", ")} WHERE id = ?`,
      values,
    );
    return this.getById(id);
  },

  async replace(id, data) {
    const payload = {
      device: data.device,
      status: data.status,
      room: data.room,
      description: data.description ?? "",
      image: data.image ?? null,
      power: data.power ?? null,
    };

    await pool.execute(
      "UPDATE items SET device = ?, status = ?, room = ?, description = ?, image = ?, power = ? WHERE id = ?",
      [
        payload.device,
        payload.status,
        payload.room,
        payload.description,
        payload.image,
        payload.power,
        id,
      ],
    );

    return this.getById(id);
  },

  async remove(id) {
    const [result] = await pool.execute("DELETE FROM items WHERE id = ?", [id]);
    return result.affectedRows > 0;
  },

  async clear() {
    await pool.query("TRUNCATE TABLE items");
  },

  async count() {
    const [rows] = await pool.query("SELECT COUNT(*) AS total FROM items");
    return Number(rows[0]?.total ?? 0);
  },
});

export const getAll = async () => await ensureRepository().getAll();
export const iterateAll = async function* () {
  yield* ensureRepository().iterateAll();
};
export const getById = async (id) => await ensureRepository().getById(id);
export const create = async (data) => await ensureRepository().create(data);
export const update = async (id, updates) =>
  await ensureRepository().update(id, updates);
export const replace = async (id, data) =>
  await ensureRepository().replace(id, data);
export const remove = async (id) => await ensureRepository().remove(id);
export const clear = async () => await ensureRepository().clear();
export const count = async () => await ensureRepository().count();
