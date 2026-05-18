const bc = require('bcryptjs');
const mongoose = require('mongoose');
require('dotenv').config();
(async () => {
  const c = await mongoose.createConnection(process.env.MONGODB_URI).asPromise();
  const col = c.db.collection('users');
  
  // Completely delete and recreate mostafa
  const old = await col.findOne({ username: 'mostafa' });
  console.log('Old mostafa found:', !!old);
  
  await col.deleteOne({ username: 'mostafa' });
  
  const salt = bc.genSaltSync(10);
  const hash = bc.hashSync('123456', salt);
  
  await col.insertOne({
    username: 'mostafa',
    email: 'mostafa@radio.com',
    password: hash,
    name: 'مصطفى الخشن',
    role: 'hr',
    department: 'الموارد البشرية',
    isActive: true,
    baseSalary: 500,
    createdAt: new Date(),
    updatedAt: new Date(),
    __v: 0
  });
  
  const m = await col.findOne({ username: 'mostafa' });
  console.log('New mostafa hash match:', bc.compareSync('123456', m.password));
  
  await c.close();
  console.log('Mostafa recreated with password: 123456');
})();
