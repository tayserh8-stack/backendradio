const mongoose = require('mongoose');
require('dotenv').config();
(async () => {
  const c = await mongoose.createConnection(process.env.MONGODB_URI).asPromise();
  const admin = await c.db.collection('users').findOne({ username: 'admin' });
  if (admin) {
    console.log('Admin EXISTS in DB');
    console.log('createdAt:', admin.createdAt);
    console.log('password:', admin.password.substring(0, 25) + '...');
    const bc = require('bcryptjs');
    console.log('admin123 match:', bc.compareSync('admin123', admin.password));
  } else {
    console.log('Admin NOT in DB - Render has not restarted yet');
  }

  const mostafa = await c.db.collection('users').findOne({ username: 'mostafa' });
  if (mostafa) {
    console.log('\nMostafa password hash:', mostafa.password.substring(0, 25) + '...');
    const bc = require('bcryptjs');
    console.log('123456 match:', bc.compareSync('123456', mostafa.password));
  }
  await c.close();
})();
