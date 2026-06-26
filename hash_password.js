// hash_password.js
// Usage: node hash_password.js "your_password"
// This script hashes the provided password using bcryptjs and prints the hash.

const bcrypt = require('bcryptjs');
const password = process.argv[2];
if (!password) {
  console.error('Please provide a password as the first argument.');
  process.exit(1);
}
const hash = bcrypt.hashSync(password, 10);
console.log(hash);
