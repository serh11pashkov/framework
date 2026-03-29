import * as repo from "#repositories";

export const getDevices = async ({ room } = {}) => {
  const all = await repo.getAll();
  const items = room
    ? all.filter((d) => d.room.toLowerCase() === room.toLowerCase())
    : all;
  return { count: items.length, items };
};

export const getDeviceById = async (id) => await repo.getById(id);

export const createDevice = async (data) =>
  await repo.create({
    device: data.device.trim(),
    status: data.status ?? "off",
    room: data.room.trim(),
    description: data.description?.trim() ?? "",
  });

export const patchDevice = async (id, data) => await repo.update(id, data);

export const replaceDevice = async (id, data) =>
  await repo.replace(id, {
    device: data.device.trim(),
    status: data.status,
    room: data.room.trim(),
    description: data.description?.trim() ?? "",
  });

export const deleteDevice = async (id) => await repo.remove(id);
