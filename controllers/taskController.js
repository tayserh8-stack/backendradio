/**
 * Task Controller
 * Handles all task-related operations
 */

const { Task, TaskStatus, TaskDifficulty } = require('../models/Task');
const { User, UserRole } = require('../models/User');
const { Notification, NotificationType } = require('../models/Notification');

/**
 * Create new task (manager or employee)
 * POST /api/tasks
 */
const createTask = async (req, res) => {
  try {
    const { 
      title, 
      description, 
      assignedTo, 
      difficulty, 
      duration,
      startTime,
      endTime,
      isUnusual,
      taskDate,
      dueDate
    } = req.body;

    // Validate required fields
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال عنوان المهمة'
      });
    }

    // Create task
    const task = await Task.create({
      title,
      description,
      createdBy: req.user._id,
      assignedTo: assignedTo || [req.user._id], // Default to self if no one assigned
      difficulty: difficulty || TaskDifficulty.MEDIUM,
      duration,
      startTime,
      endTime,
      isUnusual: isUnusual || false,
      taskDate: taskDate || new Date(),
      dueDate,
      status: TaskStatus.PENDING
    });

    // Populate assigned users
    await task.populate('assignedTo', 'name email department');
    await task.populate('createdBy', 'name');

    // Create notifications for assigned employees and track if any were created
    let notificationCreated = false;
    for (const userId of task.assignedTo) {
      if (userId.toString() !== req.user._id.toString()) {
        await Notification.createNotification(
          userId,
          NotificationType.TASK_ASSIGNED,
          'مهمة جديدة',
          `تم إسناد مهمة "${title}" إليك`,
          task._id
        );
        notificationCreated = true;
      }
    }

    res.status(201).json({
      success: true,
      message: 'تم إنشاء المهمة بنجاح',
      data: {
        task,
        playNotificationSound: notificationCreated
      }
    });
  } catch (error) {
    console.error('خطأ في إنشاء المهمة:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Get tasks for current user
 * GET /api/tasks/my-tasks
 */
const getMyTasks = async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;
    
    // Build query
    const query = {
      assignedTo: req.user._id
    };

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.taskDate = {};
      if (startDate) query.taskDate.$gte = new Date(startDate);
      if (endDate) query.taskDate.$lte = new Date(endDate);
    }

    const tasks = await Task.find(query)
      .populate('createdBy', 'name')
      .sort({ taskDate: -1, createdAt: -1 });

    res.json({
      success: true,
      data: {
        tasks
      }
    });
  } catch (error) {
    console.error('خطأ في جلب المهام:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Get tasks created by current user
 * GET /api/tasks/created
 */
const getCreatedTasks = async (req, res) => {
  try {
    const { status } = req.query;
    
    const query = {
      createdBy: req.user._id
    };

    if (status) {
      query.status = status;
    }

    const tasks = await Task.find(query)
      .populate('assignedTo', 'name email department')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        tasks
      }
    });
  } catch (error) {
    console.error('خطأ في جلب المهام:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Get tasks for manager to evaluate
 * GET /api/tasks/to-evaluate
 */
const getTasksToEvaluate = async (req, res) => {
  try {
    // Get employees in manager's department
    const employees = await User.find({
      role: UserRole.EMPLOYEE,
      department: req.user.department
    });

    const employeeIds = employees.map(e => e._id);

    // Get completed tasks awaiting evaluation
    const tasks = await Task.find({
      assignedTo: { $in: employeeIds },
      status: TaskStatus.COMPLETED,
      isApprovedByManager: false
    })
      .populate('assignedTo', 'name email department')
      .populate('createdBy', 'name')
      .sort({ endTime: -1 });

    res.json({
      success: true,
      data: {
        tasks
      }
    });
  } catch (error) {
    console.error('خطأ في جلب المهام للتقييم:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Get tasks for admin approval
 * GET /api/tasks/to-approve
 */
const getTasksToApprove = async (req, res) => {
  try {
    // Get manager-approved tasks
    const tasks = await Task.find({
      status: TaskStatus.APPROVED,
      isApprovedByManager: true
    })
      .populate('assignedTo', 'name email department')
      .populate('createdBy', 'name')
      .sort({ managerApprovalDate: -1 });

    res.json({
      success: true,
      data: {
        tasks
      }
    });
  } catch (error) {
    console.error('خطأ في جلب المهام للapproval:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Update task status
 * PUT /api/tasks/:id/status
 */
const updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'المهمة غير موجودة'
      });
    }

    // Check if user is assigned to this task or is manager
    const isAssigned = task.assignedTo.some(a => a.toString() === req.user._id.toString());
    const isManager = req.user.role === 'manager' || req.user.role === 'admin';
    
    if (!isAssigned && !isManager) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بتحديث هذه المهمة'
      });
    }

    // Update status
    task.status = status;
    
    // If completing, set end time
    if (status === TaskStatus.COMPLETED) {
      task.endTime = new Date();
    }

    await task.save();

    // Create notification for task creator
    await Notification.createNotification(
      task.createdBy,
      NotificationType.TASK_COMPLETED,
      'تم إكمال المهمة',
      `تم إكمال المهمة "${task.title}"`,
      task._id
    );

    res.json({
      success: true,
      message: 'تم تحديث حالة المهمة بنجاح',
      data: {
        task
      }
    });
  } catch (error) {
    console.error('خطأ في تحديث المهمة:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Evaluate task (manager only)
 * POST /api/tasks/:id/evaluate
 */
const evaluateTask = async (req, res) => {
  try {
    const { score, notes } = req.body;

    // Validate score
    if (score === undefined || score < 0 || score > 100) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال تقييم صحيح (0-100)'
      });
    }

    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'المهمة غير موجودة'
      });
    }

    // Check if task is completed
    if (task.status !== TaskStatus.COMPLETED) {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن تقييم مهمة غير مكتملة'
      });
    }

    // Update evaluation
    task.managerScore = score;
    task.managerNotes = notes || '';
    task.isApprovedByManager = true;
    task.status = TaskStatus.APPROVED;
    task.managerApprovalDate = new Date();

    await task.save();

    // Create notifications for assigned employees
    for (const userId of task.assignedTo) {
      await Notification.createNotification(
        userId,
        NotificationType.TASK_EVALUATED,
        'تم تقييم مهمتك',
        `تم تقييم مهمتك "${task.title}" بـ ${score} درجة`,
        task._id
      );
    }

    // Recalculate performance score
    const user = await User.findById(task.assignedTo[0]);
    if (user) {
      const tasks = await Task.find({
        assignedTo: user._id,
        status: { $in: [TaskStatus.APPROVED, TaskStatus.FINAL_APPROVED] },
        managerScore: { $ne: null }
      });

      const totalScore = tasks.reduce((sum, t) => sum + t.managerScore, 0);
      const avgScore = tasks.length > 0 ? totalScore / tasks.length : 0;
      user.performanceScore = Math.round(avgScore * 100) / 100;
      await user.save();
    }

    res.json({
      success: true,
      message: 'تم تقييم المهمة بنجاح',
      data: {
        task
      }
    });
  } catch (error) {
    console.error('خطأ في تقييم المهمة:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Approve task (admin only)
 * POST /api/tasks/:id/final-approve
 */
const finalApproveTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'المهمة غير موجودة'
      });
    }

    // Check if task is approved by manager
    if (!task.isApprovedByManager) {
      return res.status(400).json({
        success: false,
        message: 'يجب أن تتم الموافقة على المهمة من المدير أولاً'
      });
    }

    // Update status
    task.status = TaskStatus.FINAL_APPROVED;
    await task.save();

    // Create notifications
    for (const userId of task.assignedTo) {
      await Notification.createNotification(
        userId,
        NotificationType.TASK_APPROVED,
        'تمت الموافقة على مهمتك',
        `تمت الموافقة النهائية على المهمة "${task.title}"`,
        task._id
      );
    }

    res.json({
      success: true,
      message: 'تمت الموافقة على المهمة بنجاح',
      data: {
        task
      }
    });
  } catch (error) {
    console.error('خطأ في الموافقة على المهمة:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Get task by ID
 * GET /api/tasks/:id
 */
const getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'name email department')
      .populate('createdBy', 'name email');
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'المهمة غير موجودة'
      });
    }

    res.json({
      success: true,
      data: {
        task
      }
    });
  } catch (error) {
    console.error('خطأ في جلب المهمة:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Update task
 * PUT /api/tasks/:id
 */
const updateTask = async (req, res) => {
  try {
    const { 
      title, 
      description, 
      assignedTo, 
      difficulty, 
      duration,
      startTime,
      endTime,
      isUnusual,
      dueDate
    } = req.body;

    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'المهمة غير موجودة'
      });
    }

    // Check permission
    const isCreator = task.createdBy.toString() === req.user._id.toString();
    const isManager = req.user.role === 'manager' || req.user.role === 'admin';
    
    if (!isCreator && !isManager) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بتعديل هذه المهمة'
      });
    }

    // Update fields
    if (title) task.title = title;
    if (description !== undefined) task.description = description;
    if (assignedTo) task.assignedTo = assignedTo;
    if (difficulty) task.difficulty = difficulty;
    if (duration !== undefined) task.duration = duration;
    if (startTime) task.startTime = startTime;
    if (endTime) task.endTime = endTime;
    if (isUnusual !== undefined) task.isUnusual = isUnusual;
    if (dueDate) task.dueDate = dueDate;

    await task.save();
    await task.populate('assignedTo', 'name email department');

    res.json({
      success: true,
      message: 'تم تحديث المهمة بنجاح',
      data: {
        task
      }
    });
  } catch (error) {
    console.error('خطأ في تحديث المهمة:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Delete task
 * DELETE /api/tasks/:id
 */
const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'المهمة غير موجودة'
      });
    }

    // Check permission
    const isCreator = task.createdBy.toString() === req.user._id.toString();
    const isManager = req.user.role === 'manager' || req.user.role === 'admin';
    
    if (!isCreator && !isManager) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بحذف هذه المهمة'
      });
    }

    await task.deleteOne();

    res.json({
      success: true,
      message: 'تم حذف المهمة بنجاح'
    });
  } catch (error) {
    console.error('خطأ في حذف المهمة:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Get total tasks count (all time)
 * GET /api/tasks/total
 */
const getTotalTasks = async (req, res) => {
  try {
    const totalTasks = await Task.countDocuments();
    const completedTasks = await Task.countDocuments({ 
      status: { $in: [TaskStatus.COMPLETED, TaskStatus.APPROVED, TaskStatus.FINAL_APPROVED] }
    });
    
    res.json({
      success: true,
      data: {
        total: totalTasks,
        completed: completedTasks
      }
    });
  } catch (error) {
    console.error('خطأ في جلب总数 المهام:', error.message);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب总数 المهام'
    });
  }
};

/**
 * Get daily tasks summary
 * GET /api/tasks/summary/daily
 */
const getDailySummary = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const tasks = await Task.find({
      taskDate: {
        $gte: targetDate,
        $lt: nextDate
      }
    }).populate('assignedTo', 'name');

    // Filter based on user role
    let filteredTasks = tasks;
    if (req.user.role === 'employee') {
      filteredTasks = tasks.filter(t => 
        t.assignedTo.some(a => a._id.toString() === req.user._id.toString())
      );
    } else if (req.user.role === 'manager') {
      const deptEmployees = await User.find({
        role: 'employee',
        department: req.user.department
      }).select('_id');
      const deptEmployeeIds = deptEmployees.map(e => e._id);
      filteredTasks = tasks.filter(t => 
        t.assignedTo.some(a => deptEmployeeIds.includes(a._id.toString()))
      );
    }

    const summary = {
      total: filteredTasks.length,
      completed: filteredTasks.filter(t => t.status === TaskStatus.COMPLETED || t.status === TaskStatus.APPROVED || t.status === TaskStatus.FINAL_APPROVED).length,
      inProgress: filteredTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
      pending: filteredTasks.filter(t => t.status === TaskStatus.PENDING).length,
      unusual: filteredTasks.filter(t => t.isUnusual).length,
      totalHours: filteredTasks.reduce((sum, t) => sum + (t.duration || 0), 0)
    };

    res.json({
      success: true,
      data: {
        summary,
        date: targetDate
      }
    });
  } catch (error) {
    console.error('خطأ في جلب الملخص:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Get weekly tasks summary
 * GET /api/tasks/summary/weekly
 */
const getWeeklySummary = async (req, res) => {
  try {
    const { startDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay()); // Start of week (Sunday)
    
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const tasks = await Task.find({
      taskDate: {
        $gte: start,
        $lt: end
      }
    }).populate('assignedTo', 'name');

    // Filter based on user role
    let filteredTasks = tasks;
    if (req.user.role === 'employee') {
      filteredTasks = tasks.filter(t => 
        t.assignedTo.some(a => a._id.toString() === req.user._id.toString())
      );
    } else if (req.user.role === 'manager') {
      const deptEmployees = await User.find({
        role: 'employee',
        department: req.user.department
      }).select('_id');
      const deptEmployeeIds = deptEmployees.map(e => e._id);
      filteredTasks = tasks.filter(t => 
        t.assignedTo.some(a => deptEmployeeIds.includes(a._id.toString()))
      );
    }

    const summary = {
      total: filteredTasks.length,
      completed: filteredTasks.filter(t => t.status === TaskStatus.COMPLETED || t.status === TaskStatus.APPROVED || t.status === TaskStatus.FINAL_APPROVED).length,
      inProgress: filteredTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
      pending: filteredTasks.filter(t => t.status === TaskStatus.PENDING).length,
      unusual: filteredTasks.filter(t => t.isUnusual).length,
      totalHours: filteredTasks.reduce((sum, t) => sum + (t.duration || 0), 0)
    };

    res.json({
      success: true,
      data: {
        summary,
        startDate: start,
        endDate: end
      }
    });
  } catch (error) {
    console.error('خطأ في جلب الملخص:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Get task reports for export
 * GET /api/tasks/reports
 */
const getTaskReports = async (req, res) => {
  try {
    const { startDate, endDate, department } = req.query;
    
    // Build query
    const query = {};
    
    if (startDate || endDate) {
      query.taskDate = {};
      if (startDate) query.taskDate.$gte = new Date(startDate);
      if (endDate) query.taskDate.$lte = new Date(endDate);
    }

    // Get tasks
    let tasks = await Task.find(query)
      .populate('assignedTo', 'name email department')
      .populate('createdBy', 'name')
      .sort({ taskDate: -1 });

    // Filter based on user role
    if (req.user.role === 'employee') {
      tasks = tasks.filter(t => 
        t.assignedTo.some(a => a._id.toString() === req.user._id.toString())
      );
    } else if (req.user.role === 'manager') {
      const deptEmployees = await User.find({
        role: 'employee',
        department: req.user.department
      }).select('_id');
      const deptEmployeeIds = deptEmployees.map(e => e._id);
      tasks = tasks.filter(t => 
        t.assignedTo.some(a => deptEmployeeIds.includes(a._id.toString()))
      );
    }

    // Filter by department if specified
    if (department) {
      tasks = tasks.filter(t => 
        t.assignedTo.some(a => a.department === department)
      );
    }

    res.json({
      success: true,
      data: {
        tasks,
        count: tasks.length
      }
    });
  } catch (error) {
    console.error('خطأ في جلب التقارير:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

module.exports = {
  createTask,
  getMyTasks,
  getCreatedTasks,
  getTasksToEvaluate,
  getTasksToApprove,
  updateTaskStatus,
  evaluateTask,
  finalApproveTask,
  getTaskById,
  updateTask,
  deleteTask,
  getDailySummary,
  getWeeklySummary,
  getTaskReports,
  getTotalTasks
};