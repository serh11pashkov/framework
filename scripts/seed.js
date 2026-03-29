import { create } from "../repositories/deviceRepository.js";

const DEVICES = [
  {
    device: "Smart Lamp",
    status: "on",
    room: "Kitchen",
    description: "Main light",
  },
  {
    device: "Smart Thermostat",
    status: "off",
    room: "Living Room",
    description: "Nest Gen 3",
  },
];

const seed = async () => {
  for (const item of DEVICES) {
    await create(item);
  }
  console.log("Database seeded!");
};

seed();
