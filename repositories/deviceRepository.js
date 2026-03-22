let DEVICES = [
  { id: 1, device: "Smart Lamp", status: "on", room: "Kitchen" },
  { id: 2, device: "Smart Thermostat", status: "off", room: "Living Room" },
  { id: 3, device: "Smart Lock", status: "on", room: "Entrance" },
  { id: 4, device: "Smart Camera", status: "on", room: "Kitchen" },
];

export const getAll = () => DEVICES;

export const getById = (id) => DEVICES.find((d) => d.id === id);

export const create = (data) => {
  const id = DEVICES.length > 0 ? DEVICES[DEVICES.length - 1].id + 1 : 1;
  const device = { id, ...data };
  DEVICES.push(device);
  return device;
};

export const update = (id, updates) => {
  const index = DEVICES.findIndex((d) => d.id === id);
  if (index === -1) return null;
  DEVICES[index] = { ...DEVICES[index], ...updates };
  return DEVICES[index];
};

export const replace = (id, data) => {
  const index = DEVICES.findIndex((d) => d.id === id);
  if (index === -1) return null;
  DEVICES[index] = { id, ...data };
  return DEVICES[index];
};

export const remove = (id) => {
  const before = DEVICES.length;
  DEVICES = DEVICES.filter((d) => d.id !== id);
  return DEVICES.length < before;
};
