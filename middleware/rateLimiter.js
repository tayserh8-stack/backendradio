const rateLimit = require('express-rate-limit');

const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 500,
  message: {
    success: false,
    message: 'طلبات كثيرة جداً، حاول مرة أخرى لاحقاً'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  },
  handler: (req, res) => {
    console.warn(`[RATE_LIMIT] IP=${req.ip} PATH=${req.originalUrl} METHOD=${req.method}`);
    res.status(429).json({
      success: false,
      message: 'طلبات كثيرة جداً، حاول مرة أخرى لاحقاً'
    });
  },
  skip: (req) => {
    if (req.path.startsWith('/uploads/')) return true;
    return false;
  }
});

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'محاولات تسجيل دخول كثيرة، حاول بعد 15 دقيقة'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    console.warn(`[RATE_LIMIT_LOGIN] IP=${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'محاولات تسجيل دخول كثيرة، حاول بعد 15 دقيقة'
    });
  }
});

const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'تم إنشاء العديد من الحسابات، تابع لاحقاً'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    console.warn(`[RATE_LIMIT_REGISTER] IP=${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'تم إنشاء العديد من الحسابات، تابع لاحقاً'
    });
  }
});

module.exports = {
  globalRateLimiter,
  loginRateLimiter,
  registerRateLimiter,
};
