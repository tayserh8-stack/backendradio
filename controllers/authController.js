/**
 * Auth Controller
 * Handles user authentication (register, login, logout)
 */

const jwt = require('jsonwebtoken');
const { User, UserRole, Department } = require('../models/User');
const { Notification, NotificationType } = require('../models/Notification');
const { generateToken, JWT_SECRET } = require('../middleware/authMiddleware');

const departmentNames = {
  production: 'الإنتاج',
  news: 'الأخبار',
  marketing: 'التسويق'
};

/**
 * Register new user (employee only)
 * POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    const { username, email, password, confirmPassword, name, department, role } = req.body;

    // Validate required fields
    if (!username || !email || !password || !confirmPassword || !name || !department) {
      return res.status(400).json({
        success: false,
        message: 'يرجى ملء جميع الحقول المطلوبة'
      });
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور وتأكيدها غير متطابقتين'
      });
    }

    // Check password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'يجب أن تكون كلمة المرور 6 أحرف على الأقل'
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني مستخدم بالفعل'
      });
    }

    // Check if username already exists
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({
        success: false,
        message: 'اسم المستخدم مستخدم بالفعل'
      });
    }

    // Create new user
    const user = await User.create({
      username,
      email: email.toLowerCase(),
      password,
      name,
      department,
      role: role || UserRole.EMPLOYEE
    });

    // Notify admin about new user registration
    const admin = await User.findOne({ role: 'admin' });
    if (admin) {
      await Notification.createNotification(
        admin._id,
        NotificationType.NEW_USER_REGISTERED,
        'موظف جديد بانتظار التفعيل',
        `تم تسجيل موظف جديد: ${name} (${departmentNames[department] || department}). يرجى تفعيل الحساب.`
      );
    }

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'تم التسجيل بنجاح',
      data: {
        user: user.getPublicProfile(),
        token
      }
    });
  } catch (error) {
    console.error('خطأ في التسجيل:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال اسم المستخدم وكلمة المرور'
      });
    }

    // Find user by username
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'اسم المستخدم أو كلمة المرور غير صحيحة'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'حسابك غير نشط - يرجى التواصل مع الإدارة'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'اسم المستخدم أو كلمة المرور غير صحيحة'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح',
      data: {
        user: user.getPublicProfile(),
        token
      }
    });
  } catch (error) {
    console.error('خطأ في تسجيل الدخول:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Get current user profile
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    res.json({
      success: true,
      data: {
        user: user.getPublicProfile()
      }
    });
  } catch (error) {
    console.error('خطأ في جلب الملف الشخصي:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Change password
 * POST /api/auth/change-password
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const user = await User.findById(req.user._id);

    // Validate fields
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'يرجى ملء جميع الحقول المطلوبة'
      });
    }

    // Check if new passwords match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور الجديدة وتأكيدها غير متطابقتين'
      });
    }

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور الحالية غير صحيحة'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'تم تغيير كلمة المرور بنجاح'
    });
  } catch (error) {
    console.error('خطأ في تغيير كلمة المرور:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Update profile (for admin and own profile)
 * PUT /api/auth/profile
 */
const updateProfile = async (req, res) => {
  try {
    const { name, phone, department } = req.body;
    const user = await User.findById(req.user._id);

    // Update fields
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (department && (req.user.role === 'admin' || req.user.role === 'manager')) {
      user.department = department;
    }

    await user.save();

    res.json({
      success: true,
      message: 'تم تحديث الملف الشخصي بنجاح',
      data: {
        user: user.getPublicProfile()
      }
    });
  } catch (error) {
    console.error('خطأ في تحديث الملف الشخصي:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Update profile image
 * PUT /api/auth/profile-image
 */
const updateProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'يرجى رفع صورة صالحة'
      });
    }

    const user = await User.findById(req.user._id);
    user.profileImage = `/uploads/${req.file.filename}`;
    await user.save();

    res.json({
      success: true,
      message: 'تم تحديث صورة الملف الشخصي بنجاح',
      data: {
        user: user.getPublicProfile()
      }
    });
  } catch (error) {
    console.error('خطأ في تحديث صورة الملف الشخصي:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
  changePassword,
  updateProfile,
  updateProfileImage
};
