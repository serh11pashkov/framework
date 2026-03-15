const userService = require('../services/user.service');
const { count } = require('../state/request-counter');

const getUsers = async (request, reply) => {
  const { increment } = require('../state/request-counter');
  increment();

  const users = await userService.getPublicUsers();
  return { users };
};

const getUserById = async (request, reply) => {
  const { increment } = require('../state/request-counter');
  increment();

  const userRepository = require('../repositories/user.repository');
  const { id } = request.params;
  const user = await userRepository.findById(id);
  if (!user) {
    return reply.status(404).send({ error: 'User not found' });
  }
  return { user };
};

module.exports = {
  getUsers,
  getUserById
};
