let ItemModel = null;

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

const ensureModel = () => {
  if (!ItemModel) {
    throw new Error("Item model is not initialized");
  }

  return ItemModel;
};

const normalizeDevice = (device) => {
  if (!device) return null;

  const plain =
    typeof device.toObject === "function" ? device.toObject() : device;
  const { _id, ...rest } = plain;

  return {
    ...rest,
    id: String(_id),
    power: rest.power ?? null,
  };
};

export const setItemModel = (model) => {
  ItemModel = model;
};

export const getAll = async () => {
  const items = await ensureModel().find({}).sort({ _id: 1 }).lean();
  return items.map(normalizeDevice);
};

export const iterateAll = async function* () {
  const cursor = ensureModel().find({}).sort({ _id: 1 }).lean().cursor();

  for await (const item of cursor) {
    yield normalizeDevice(item);
  }
};

export const getById = async (id) => {
  if (!OBJECT_ID_REGEX.test(String(id))) return null;
  const item = await ensureModel().findById(id).lean();
  return normalizeDevice(item);
};

export const create = async (data) => {
  const item = await ensureModel().create(data);
  return normalizeDevice(item);
};

export const update = async (id, updates) => {
  if (!OBJECT_ID_REGEX.test(String(id))) return null;
  const item = await ensureModel()
    .findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true },
    )
    .lean();

  return normalizeDevice(item);
};

export const replace = async (id, data) => {
  if (!OBJECT_ID_REGEX.test(String(id))) return null;
  const item = await ensureModel()
    .findByIdAndUpdate(id, data, {
      new: true,
      overwrite: true,
      runValidators: true,
    })
    .lean();

  return normalizeDevice(item);
};

export const remove = async (id) => {
  if (!OBJECT_ID_REGEX.test(String(id))) return false;
  const result = await ensureModel().findByIdAndDelete(id);
  return Boolean(result);
};

export const clear = async () => {
  await ensureModel().deleteMany({});
};

export const count = async () => await ensureModel().countDocuments();
