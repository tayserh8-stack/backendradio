/**
 * Employee Task Management System - Backend Server
 * Main entry point for the API
 */

// Import required packages
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { User } = require('./models/User');
const { Settings } = require('./models/Settings');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const taskRoutes = require('./routes/taskRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const bonusRoutes = require('./routes/bonusRoutes');
const departmentRoutes = require('./routes/departmentRoutes');

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to database
connectDB();

// Initialize default data
const initializeData = async () => {
  try {
    // Create admin account if not exists
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      await User.create({
        username: 'admin',
        email: 'admin@radio.com',
        password: 'admin',
        name: 'المدير العام',
        role: 'admin',
        department: null,
        isActive: true
      });
      console.log('✅ تم إنشاء حساب المدير العام (admin)');
    }

    // Initialize default settings
    await Settings.initializeDefaults();
  } catch (error) {
    console.error('خطأ في تهيئة البيانات:', error.message);
  }
};

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/bonuses', bonusRoutes);
app.use('/api/departments', departmentRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'success', 
    message: 'الخادم يعمل بشكل صحيح',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('خطأ في الخادم:', err);
  res.status(500).json({
    success: false,
    message: 'حدث خطأ في الخادم'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'المسار غير موجود'
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ الخادم يعمل على المنفذ ${PORT}`);
  initializeData();
});

module.exports = app;
