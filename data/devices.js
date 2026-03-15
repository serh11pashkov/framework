'use strict';

let DEVICES = [
  { id: 1, device: 'Smart Lamp', status: 'on', room: 'Kitchen' },
  { id: 2, device: 'Smart Thermostat', status: 'off', room: 'Living Room' },
  { id: 3, device: 'Smart Lock', status: 'on', room: 'Entrance' },
  { id: 4, device: 'Smart Camera', status: 'on', room: 'Kitchen' }
];

const getAll = () => DEVICES;

const getById = (id) => DEVICES.find((d) => d.id === id);

const create = (deviceData) => {
  const lastId = DEVICES.length > 0 ? DEVICES[DEVICES.length - 1].id : 0;
  const newDevice = { id: lastId + 1, ...deviceData };
  DEVICES.push(newDevice);
  return newDevice;
};

const update = (id, updates) => {
  const index = DEVICES.findIndex((d) => d.id === id);
  if (index === -1) return null;
  DEVICES[index] = { ...DEVICES[index], ...updates };
  return DEVICES[index];
};

const replace = (id, deviceData) => {
  const index = DEVICES.findIndex((d) => d.id === id);
  if (index === -1) return null;
  DEVICES[index] = { id, ...deviceData };
  return DEVICES[index];
};

const remove = (id) => {
  const before = DEVICES.length;
  DEVICES = DEVICES.filter((d) => d.id !== id);
  return DEVICES.length < before;
};

module.exports = { getAll, getById, create, update, replace, remove };
