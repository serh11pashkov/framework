import * as userRepository from '../repositories/user.repository.js';
import { increment } from '../state/request-counter.js';

export const getUsers = async (request, reply) => {
  increment();

  const users = await userRepository.findAll();
  return { users };
};

const getUserById = async (request, reply) => {
  increment();
  const { id } = request.params;
  const user = await userRepository.findById(id);
  if (!user) {
    return reply.status(404).send({ error: 'User not found' });
  }
  return { user };
};

export default {
  getUserById,
  getUsers,
  getUserById
};
