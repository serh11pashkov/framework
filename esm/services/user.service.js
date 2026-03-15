import userController from '../controllers/user.controller.js';
import * as userRepository from '../repositories/user.repository.js';
import { formatName } from '../utils/formatter.js';
import rolesMap from '../data/roles.json' with { type: 'json' };

export const initPermissions = () => {
  console.log('Initializing permissions for controller:', typeof userController);
};

export const getPublicUsers = async () => {
  const users = await userRepository.findAll();

  return users.map((u) => ({
    id: u.id,
    name: formatName(u.name),
    roleName: rolesMap[u.id] || 'Unknown'
  }));
};

export const getUserFormatted = async (id, reply) => {
  return userController.getUserById({ params: { id } }, reply);
};
