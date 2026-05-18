const bc = require('bcryptjs');
const mongoose = require('mongoose');
require('dotenv').config();

(async () => {
  const c = await mongoose.createConnection(process.env.MONGODB_URI).asPromise();
  const col = c.db.collection('users');
  
  await col.deleteOne({ username: 'admin' });
  
  const salt = bc.genSaltSync(10);
  const hash = bc.hashSync('admin123', salt);
  
  await col.insertOne({
    username: 'admin',
    email: 'admin@radio.com',
    password: hash,
    name: 'المدير العام',
    role: 'admin',
    department: null,
    isActive: true,
    baseSalary: 500,
    createdAt: new Date(),
    updatedAt: new Date(),
    __v: 0
  });
  
  console.log('Admin created with password: admin123');
  
  const mHash = bc.hashSync('123456', bc.genSaltSync(10));
  await col.updateOne({ username: 'mostafa' }, { $set: { password: mHash } });
  console.log('Mostafa password reset to: 123456');
  
  // Verify
  const a = await col.findOne({ username: 'admin' });
  console.log('Admin hash match:', bc.compareSync('admin123', a.password));
  const m = await col.findOne({ username: 'mostafa' });
  console.log('Mostafa hash match:', bc.compareSync('123456', m.password));
  
  await c.close();
  console.log('Done. Now test login on Render.');
})();
