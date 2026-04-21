/**
 * Employee Task Management System - Backend Server
 * Main entry point for the API
 * Modified for cloud deployment (Render)
 */

// Import required packages
const express = require('express');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');
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
const messageRoutes = require('./routes/messageRoutes');

// Initialize Express app
const app = express();

// === إعدادات CORS للسحابة ===
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',  // ← يسمح لجميع النطاقات
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
        password: process.env.ADMIN_PASSWORD || crypto.randomBytes(16).toString('hex'),
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
app.use('/api/messages', messageRoutes);

// Health check endpoint (مهم لـ Render)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'success', 
    message: 'الخادم يعمل بشكل صحيح',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Employee Task Management API is running',
    version: '1.0.0',
    docs: '/api/health'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('خطأ في الخادم:', err);
  res.status(500).json({
    success: false,
    message: 'حدث خطأ في الخادم',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'المسار غير موجود'
  });
});

// === إعدادات التشغيل للسحابة ===
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // مهم ليعمل على Render

// دالة بدء التشغيل
const startServer = () => {
  app.listen(PORT, HOST, () => {
    console.log(`✅ الخادم يعمل على ${HOST}:${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    initializeData();
  });
};

// التعامل مع إشارات الإغلاق الآمن
process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🔄 SIGINT received, shutting down gracefully');
  process.exit(0);
});

// بدء السيرفر
startServer();

// تصدير التطبيق للاستخدام في الاختبارات أو الـ serverless
module.exports = app;