/**
 * User Controller
 * Handles user management (CRUD operations, role assignment)
 */

const { User, UserRole } = require('../models/User');
const { Task, TaskStatus } = require('../models/Task');
const { Settings, DEFAULT_EVALUATION_WEIGHTS } = require('../models/Settings');
const { Notification, NotificationType } = require('../models/Notification');
const Department = require('../models/Department');

/**
 * Get all employees
 * GET /api/users/employees
 */
const getAllEmployees = async (req, res) => {
  try {
    const employees = await User.find({ role: UserRole.EMPLOYEE })
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        employees
      }
    });
  } catch (error) {
    console.error('خطأ في جلب الموظفين:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Get employees by department
 * GET /api/users/department/:department
 */
const getEmployeesByDepartment = async (req, res) => {
  try {
    const { department } = req.params;
    
    const employees = await User.find({ 
      role: UserRole.EMPLOYEE,
      department 
    })
      .select('-password')
      .sort({ name: 1 });

    res.json({
      success: true,
      data: {
        employees
      }
    });
  } catch (error) {
    console.error('خطأ في جلب موظفين القسم:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Get all managers
 * GET /api/users/managers
 */
const getAllManagers = async (req, res) => {
  try {
    const managers = await User.find({ role: UserRole.MANAGER })
      .select('-password')
      .sort({ department: 1 });

    res.json({
      success: true,
      data: {
        managers
      }
    });
  } catch (error) {
    console.error('خطأ في جلب المديرين:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Get single user by ID
 * GET /api/users/:id
 */
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    res.json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    console.error('خطأ في جلب المستخدم:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Create new user (admin only)
 * POST /api/users
 */
const createUser = async (req, res) => {
  try {
    const { username, email, password, name, role, department } = req.body;

    // Validate required fields
    if (!username || !email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: 'يرجى ملء الحقول المطلوبة'
      });
    }

    // Check if email exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني مستخدم بالفعل'
      });
    }

    // Check if username exists
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({
        success: false,
        message: 'اسم المستخدم مستخدم بالفعل'
      });
    }

    // For manager role, restrict to their department only
    if (req.user.role === 'manager') {
      // Manager can only create employees (not other managers or admins)
      if (role === 'manager' || role === 'admin') {
        return res.status(403).json({
          success: false,
          message: 'غير مصرح لك بإنشاء هذا الدور'
        });
      }
      // Manager can only assign employees to their department
      if (department && department !== req.user.department) {
        return res.status(403).json({
          success: false,
          message: 'غير مصرح لك بإضافة موظفين لأقسام أخرى'
        });
      }
      // Force department to be the manager's department
      department = req.user.department;
    }

    // Create user
    const user = await User.create({
      username,
      email: email.toLowerCase(),
      password,
      name,
      role: role || UserRole.EMPLOYEE,
      department,
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: 'تم إنشاء المستخدم بنجاح',
      data: {
        user: user.getPublicProfile()
      }
    });
  } catch (error) {
    console.error('خطأ في إنشاء المستخدم:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Update user (admin only)
 * PUT /api/users/:id
 */
const updateUser = async (req, res) => {
  try {
    const { name, phone, department, role, isActive } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    const previousRole = user.role;
    let roleChanged = false;

    // Update fields
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (department) user.department = department;
    if (role) {
      if (user.role !== role) {
        roleChanged = true;
      }
      user.role = role;
    }
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();

    // Create notification for role change
    if (roleChanged) {
      const roleNames = {
        [UserRole.ADMIN]: 'المدير العام',
        [UserRole.MANAGER]: 'المدير',
        [UserRole.EMPLOYEE]: 'موظف'
      };
      
      await Notification.createNotification(
        user._id,
        NotificationType.ROLE_CHANGE,
        'تغيير الدور',
        `تم تغيير دورك إلى ${roleNames[role] || role}`,
        null
      );
    }

    res.json({
      success: true,
      message: 'تم تحديث المستخدم بنجاح',
      data: {
        user: user.getPublicProfile(),
        roleChanged
      }
    });
  } catch (error) {
    console.error('خطأ في تحديث المستخدم:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Delete user (admin only)
 * DELETE /api/users/:id
 */
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    // Prevent deleting admin
    if (user.role === UserRole.ADMIN) {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن حذف حساب المدير العام'
      });
    }

    await user.deleteOne();

    res.json({
      success: true,
      message: 'تم حذف المستخدم بنجاح'
    });
  } catch (error) {
    console.error('خطأ في حذف المستخدم:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Calculate performance score for a user
 * POST /api/users/:id/calculate-score
 */
const calculatePerformanceScore = async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Get evaluation weights from settings
    const weights = await Settings.getEvaluationWeights();
    
    // Get user's completed tasks
    const tasks = await Task.find({
      assignedTo: userId,
      status: { $in: [TaskStatus.APPROVED, TaskStatus.FINAL_APPROVED] },
      managerScore: { $ne: null }
    });

    if (tasks.length === 0) {
      return res.json({
        success: true,
        data: {
          performanceScore: 0,
          details: {
            managerScoreComponent: 0,
            hoursComponent: 0,
            tasksComponent: 0,
            difficultyMultiplier: 1
          }
        }
      });
    }

    // Calculate manager average score
    const totalManagerScore = tasks.reduce((sum, task) => sum + (task.managerScore || 0), 0);
    const avgManagerScore = totalManagerScore / tasks.length;

    // Calculate total worked hours
    const totalHours = tasks.reduce((sum, task) => sum + (task.duration || 0), 0);

    // Get all assigned tasks count
    const assignedTasksCount = await Task.countDocuments({
      assignedTo: userId
    });

    // Get completed tasks count
    const completedTasksCount = await Task.countDocuments({
      assignedTo: userId,
      status: { $in: [TaskStatus.COMPLETED, TaskStatus.APPROVED, TaskStatus.FINAL_APPROVED] }
    });

    // Calculate average task difficulty
    const totalDifficulty = tasks.reduce((sum, task) => sum + task.difficulty, 0);
    const avgDifficulty = totalDifficulty / tasks.length / 100; // Normalize to 0-1

    // Calculate final score using the formula
    const managerScoreComponent = avgManagerScore * weights.managerScoreWeight;
    const hoursComponent = (totalHours / weights.requiredHoursPerWeek) * weights.hoursWeight * 100;
    const tasksComponent = (completedTasksCount / (assignedTasksCount || 1)) * weights.tasksWeight * 100;

    let finalScore = (managerScoreComponent + hoursComponent + tasksComponent) * (1 + avgDifficulty);

    // Cap at 100
    finalScore = Math.min(finalScore, 100);

    // Update user's performance score
    await User.findByIdAndUpdate(userId, { performanceScore: finalScore });

    res.json({
      success: true,
      data: {
        performanceScore: Math.round(finalScore * 100) / 100,
        details: {
          managerScoreComponent: Math.round(managerScoreComponent * 100) / 100,
          hoursComponent: Math.round(hoursComponent * 100) / 100,
          tasksComponent: Math.round(tasksComponent * 100) / 100,
          difficultyMultiplier: Math.round((1 + avgDifficulty) * 100) / 100,
          totalTasks: tasks.length,
          totalHours,
          avgManagerScore: Math.round(avgManagerScore * 100) / 100,
          avgDifficulty: Math.round(avgDifficulty * 100) / 100
        }
      }
    });
  } catch (error) {
    console.error('خطأ في حساب نقاط الأداء:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Get employee rankings
 * GET /api/users/rankings
 */
const getRankings = async (req, res) => {
  try {
    // Get minimum tasks from settings
    const minTasks = await Settings.getValue('minimumTasksForRanking', DEFAULT_EVALUATION_WEIGHTS.minimumTasksForRanking);

    // Get employees with at least minTasks completed
    const employees = await User.find({ role: UserRole.EMPLOYEE })
      .select('-password')
      .sort({ performanceScore: -1 });

    // Filter employees with enough tasks
    const rankings = await Promise.all(
      employees.map(async (employee, index) => {
        const completedTasksCount = await Task.countDocuments({
          assignedTo: employee._id,
          status: { $in: [TaskStatus.APPROVED, TaskStatus.FINAL_APPROVED] }
        });

        return {
          rank: index + 1,
          user: employee.getPublicProfile(),
          completedTasks: completedTasksCount,
          performanceScore: employee.performanceScore
        };
      })
    );

    // Filter by minimum tasks and sort by performance score
    const filteredRankings = rankings
      .filter(r => r.completedTasks >= minTasks)
      .sort((a, b) => b.performanceScore - a.performanceScore)
      .map((r, index) => ({ ...r, rank: index + 1 }));

    res.json({
      success: true,
      data: {
        rankings: filteredRankings
      }
    });
  } catch (error) {
    console.error('خطأ في جلب الترتيب:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Get department statistics
 * GET /api/users/department-stats
 */
const getDepartmentStats = async (req, res) => {
  try {
    const dbDepartments = await Department.find().sort({ createdAt: -1 });
    
    const staticDepts = ['production', 'news', 'marketing'];
    const allDepts = [...staticDepts.map(d => ({ name: d, _id: d })), ...dbDepartments];
    
    const stats = [];

    for (const dept of allDepts) {
      const deptName = dept.name || dept;
      
      const employees = await User.find({ 
        role: UserRole.EMPLOYEE,
        department: deptName
      });

      const totalScore = employees.reduce((sum, emp) => sum + (emp.performanceScore || 0), 0);
      const avgScore = employees.length > 0 ? totalScore / employees.length : 0;

      const deptTasks = await Task.find({
        assignedTo: { $in: employees.map(e => e._id) }
      });

      const completedTasks = deptTasks.filter(t => 
        t.status === TaskStatus.APPROVED || t.status === TaskStatus.FINAL_APPROVED
      ).length;

      stats.push({
        department: deptName,
        employeeCount: employees.length,
        totalTasks: deptTasks.length,
        completedTasks,
        averagePerformanceScore: Math.round(avgScore * 10) / 10
      });
    }

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    console.error('خطأ في جلب إحصائيات الأقسام:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Get pending users (not activated)
 * GET /api/users/pending
 */
const getPendingUsers = async (req, res) => {
  try {
    const pendingUsers = await User.find({ isActive: false })
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        users: pendingUsers
      }
    });
  } catch (error) {
    console.error('خطأ في جلب المستخدمين المعلقين:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Activate user account
 * POST /api/users/:id/activate
 */
const activateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    user.isActive = true;
    await user.save();

    res.json({
      success: true,
      message: 'تم تفعيل الحساب بنجاح',
      data: {
        user: user.getPublicProfile()
      }
    });
  } catch (error) {
    console.error('خطأ في تفعيل المستخدم:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

const getUserCounts = async (req, res) => {
  try {
    const [employees, managers] = await Promise.all([
      User.countDocuments({ role: UserRole.EMPLOYEE }),
      User.countDocuments({ role: UserRole.MANAGER })
    ]);

    res.json({
      success: true,
      data: {
        employees,
        managers
      }
    });
  } catch (error) {
    console.error('خطأ في جلب عدد المستخدمين:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

module.exports = {
  getAllEmployees,
  getEmployeesByDepartment,
  getAllManagers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  calculatePerformanceScore,
  getRankings,
  getDepartmentStats,
  getPendingUsers,
  activateUser,
  getUserCounts
};