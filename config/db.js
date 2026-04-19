/**
 * Database Configuration
 * connects to MongoDB using Mongoose
 */

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Get MongoDB URI from environment or use default
    const mongoURI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/employee_task_management';
    
    await mongoose.connect(mongoURI);
    
    console.log('✅ تم الاتصال بقاعدة البيانات بنجاح');
  } catch (error) {
    console.error('❌ خطأ في الاتصال بقاعدة البيانات:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;