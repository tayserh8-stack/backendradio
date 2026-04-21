/**
 * Authentication Middleware
 * Protects routes and verifies JWT tokens
 */

const jwt = require('jsonwebtoken');
const { User } = require('../models/User');

// JWT secret key (should be in environment variables in production)
let JWT_SECRET = process.env.JWT_SECRET;

// Allow fallback in development only with warning
if (!JWT_SECRET) {
  if (process.env.NODE_ENV !== 'production') {
    JWT_SECRET = 'dev-secret-key-2024';
    console.warn('⚠️ WARNING: Using default JWT_SECRET. Set JWT_SECRET env var for production!');
  } else {
    throw new Error('FATAL: JWT_SECRET environment variable is required');
  }
}

/**
 * Middleware to protect routes - requires valid JWT token
 */
const protect = async (req, res, next) => {
  try {
    // Get token from header
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'غير مصرح لك للوصول - يرجى تسجيل الدخول'
      });
    }
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get user from database
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }
    
    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'حسابك غير نشط - يرجى التواصل مع الإدارة'
      });
    }
    
    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('خطأ في التحقق من التوكن:', error.message);
    return res.status(401).json({
      success: false,
      message: 'توكن غير صالح'
    });
  }
};

/**
 * Middleware to check if user is admin
 */
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'غير مصرح لك بالوصول لهذه الصفحة'
    });
  }
};

/**
 * Middleware to check if user is manager or admin
 */
const managerOrAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'manager' || req.user.role === 'admin')) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'غير مصرح لك بالوصول لهذه الصفحة'
    });
  }
};

/**
 * Middleware to check if user is employee (not admin)
 */
const employeeOnly = (req, res, next) => {
  if (req.user && req.user.role === 'employee') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'هذه الصفحة للموظفين فقط'
    });
  }
};

/**
 * Generate JWT token
 */
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, {
    expiresIn: '7d' // Token expires in 7 days
  });
};

module.exports = {
  protect,
  adminOnly,
  managerOrAdmin,
  employeeOnly,
  generateToken,
  JWT_SECRET
};
