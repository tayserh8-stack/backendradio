const bc = require('bcryptjs');
const mongoose = require('mongoose');
require('dotenv').config();
(async () => {
  const c = await mongoose.createConnection(process.env.MONGODB_URI).asPromise();
  const m = await c.db.collection('users').findOne({ username: 'mostafa' });
  console.log('Mostafa found:', !!m);
  console.log('Hash:', m.password.substring(0, 30) + '...');
  console.log('123456 match:', bc.compareSync('123456', m.password));
  await c.close();
})();
