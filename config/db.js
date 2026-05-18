/**
 * Database Configuration
 * connects to MongoDB using Mongoose
 */

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Get MongoDB URI from environment or use default
    const mongoURI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/employee_task_management';
    
    const masked = mongoURI.replace(/\/\/.*@/, '//***:***@');
    await mongoose.connect(mongoURI);
    
    const dbName = mongoose.connection.db?.databaseName || 'unknown';
    console.log(`✅ تم الاتصال بقاعدة البيانات بنجاح (URI: ${masked}, database: ${dbName})`);
  } catch (error) {
    console.error('❌ خطأ في الاتصال بقاعدة البيانات:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;