import * as repo from "#repositories";

export const getDevices = ({ room } = {}) => {
  const all = repo.getAll();
  const items = room
    ? all.filter((d) => d.room.toLowerCase() === room.toLowerCase())
    : all;
  return { count: items.length, items };
};

export const getDeviceById = (id) => repo.getById(id);

export const createDevice = (data) =>
  repo.create({
    device: data.device.trim(),
    status: data.status ?? "off",
    room: data.room.trim(),
  });

export const patchDevice = (id, data) => repo.update(id, data);

export const replaceDevice = (id, data) =>
  repo.replace(id, {
    device: data.device.trim(),
    status: data.status,
    room: data.room.trim(),
  });

export const deleteDevice = (id) => repo.remove(id);
