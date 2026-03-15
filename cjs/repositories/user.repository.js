const fs = require('node:fs');
const path = require('node:path');

const backupPath = path.join(__dirname, '../data/backup.json');

const users = [
  { id: 1, name: 'Charlie', role: 'admin' },
  { id: 2, name: 'Diana', role: 'user' }
];

let backupData = [];

const init = async () => {
  try {
    const rawData = await fs.promises.readFile(backupPath, 'utf8');
    backupData = JSON.parse(rawData);
  } catch (err) {
    console.warn('Could not read backup file:', err.message);
  }
};

const findAll = async () => {
  return [...users, ...backupData];
};

const findById = async (id) => {
  return users.find((u) => u.id === parseInt(id, 10));
};

module.exports = {
  init,
  findAll,
  findById
};
