/**
 * Recruitment & Performance Controller
 * Handles job postings, candidate applications, performance reviews, and KPIs
 */

const JobPosting = require('../models/RecruitmentPerformance').JobPosting;
const CandidateApplication = require('../models/RecruitmentPerformance').CandidateApplication;
const PerformanceReview = require('../models/RecruitmentPerformance').PerformanceReview;
const KPI = require('../models/RecruitmentPerformance').KPI;
const { User } = require('../models/User');
const { Notification, NotificationType } = require('../models/Notification');
const Department = require('../models/Department');

/**
 * ======================
 * JOB POSTING CONTROLLERS
 * ======================
 */

/**
 * Create job posting (admin/manager)
 * POST /api/recruitment/jobs
 */
const createJobPosting = async (req, res) => {
  try {
    const {
      title,
      department,
      jobType,
      level,
      description,
      requirements,
      responsibilities,
      preferredQualifications,
      location,
      isRemote,
      salaryRange,
      benefits,
      maxApplicants,
      closeDate,
      interviewStages,
      priority
    } = req.body;

    // Verify department exists
    const dept = await mongoose.model('Department').findById(department);
    if (!dept) {
      return res.status(404).json({ 
        success: false, 
        message: 'القسم غير موجود' 
      });
    }

    const jobPosting = await JobPosting.create({
      title,
      department,
      jobType,
      level,
      description,
      requirements,
      responsibilities,
      preferredQualifications,
      location,
      isRemote,
      salaryRange,
      benefits,
      maxApplicants,
      closeDate,
      interviewStages,
      priority,
      hiringManager: req.user._id,
      createdBy: req.user._id,
      status: JobPosting.DRAFT
    });

    res.status(201).json({ 
      success: true, 
      message: 'تم إنشاء الإعلان بنجاح',
      data: { jobPosting } 
    });
  } catch (error) {
    console.error('Error creating job posting:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في إنشاء الإعلان الوظيفي',
      error: error.message 
    });
  }
};

/**
 * Get all job postings (with filters)
 * GET /api/recruitment/jobs
 */
const getJobPostings = async (req, res) => {
  try {
    const {
      status,
      department,
      level,
      jobType,
      search,
      page = 1,
      limit = 20
    } = req.query;

    const query = {};
    
    if (status) query.status = status;
    if (level) query.level = level;
    if (jobType) query.jobType = jobType;
    
    if (department) {
      const deptDoc = await Department.findOne({ name: department });
      if (!deptDoc) {
        return res.status(404).json({
          success: false,
          message: 'القسم غير موجود'
        });
      }
      query.department = deptDoc._id;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Managers see only their department's postings
    if (req.user.role === 'manager') {
      const user = await User.findById(req.user._id);
      if (user?.department) {
        const deptDoc = await Department.findOne({ name: user.department });
        if (deptDoc) query.department = deptDoc._id;
      }
    }

    const skip = (page - 1) * limit;
    
    const jobPostings = await JobPosting.find(query)
      .populate('department', 'name')
      .populate('hiringManager', 'name username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await JobPosting.countDocuments(query);

    res.json({ 
      success: true, 
      data: {
        jobPostings,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total
        }
      }
    });
  } catch (error) {
    console.error('Error fetching job postings:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في جلب الإعلانات الوظيفية',
      error: error.message 
    });
  }
};

/**
 * Get single job posting
 * GET /api/recruitment/jobs/:id
 */
const getJobPosting = async (req, res) => {
  try {
    const jobPosting = await JobPosting.findById(req.params.id)
      .populate('department', 'name')
      .populate('hiringManager', 'name username');

    if (!jobPosting) {
      return res.status(404).json({ 
        success: false, 
        message: 'الإعلان غير موجود' 
      });
    }

    res.json({ success: true, data: { jobPosting } });
  } catch (error) {
    console.error('Error fetching job posting:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في جلب الإعلان',
      error: error.message 
    });
  }
};

/**
 * Update job posting
 * PUT /api/recruitment/jobs/:id
 */
const updateJobPosting = async (req, res) => {
  try {
    const jobPosting = await JobPosting.findById(req.params.id);

    if (!jobPosting) {
      return res.status(404).json({ 
        success: false, 
        message: 'الإعلان غير موجود' 
      });
    }

    // Check if already filled
    if (jobPosting.status === JobPosting.FILLED) {
      return res.status(403).json({ 
        success: false, 
        message: 'لا يمكن تعديل إعلان تم تعبئته' 
      });
    }

    // Check permissions (hiring manager or admin)
    if (jobPosting.hiringManager.toString() !== req.user._id.toString() && 
        req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'ليس لديك صلاحية تعديل هذا الإعلان' 
      });
    }

    const updates = req.body;
    Object.keys(updates).forEach(key => {
      if (key !== '_id') {
        jobPosting[key] = updates[key];
      }
    });

    await jobPosting.save();

    res.json({ 
      success: true, 
      message: 'تم تحديث الإعلان بنجاح',
      data: { jobPosting } 
    });
  } catch (error) {
    console.error('Error updating job posting:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في تحديث الإعلان',
      error: error.message 
    });
  }
};

/**
 * Delete job posting
 * DELETE /api/recruitment/jobs/:id
 */
const deleteJobPosting = async (req, res) => {
  try {
    const jobPosting = await JobPosting.findById(req.params.id);

    if (!jobPosting) {
      return res.status(404).json({ 
        success: false, 
        message: 'الإعلان غير موجود' 
      });
    }

    // Check if already has applications
    const applicationCount = await CandidateApplication.countDocuments({ 
      jobPosting: req.params.id 
    });
    
    if (applicationCount > 0) {
      return res.status(403).json({ 
        success: false, 
        message: 'لا يمكن حذف إعلان له طلبات' 
      });
    }

    // Check permissions
    if (jobPosting.createdBy.toString() !== req.user._id.toString() && 
        req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'ليس لديك صلاحية حذف هذا الإعلان' 
      });
    }

    await jobPosting.deleteOne();

    res.json({ 
      success: true, 
      message: 'تم حذف الإعلان بنجاح' 
    });
  } catch (error) {
    console.error('Error deleting job posting:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في حذف الإعلان',
      error: error.message 
    });
  }
};

/**
 * Publish/close job posting
 * PUT /api/recruitment/jobs/:id/status
 */
const updateJobStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const jobPosting = await JobPosting.findById(req.params.id);

    if (!jobPosting) {
      return res.status(404).json({ 
        success: false, 
        message: 'الإعلان غير موجود' 
      });
    }

    // Check permissions
    if (jobPosting.hiringManager.toString() !== req.user._id.toString() && 
        req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'ليس لديك صلاحية تعديل حالة هذا الإعلان' 
      });
    }

    jobPosting.status = status;
    
    if (status === JobPosting.CLOSED && !jobPosting.closeDate) {
      jobPosting.closeDate = new Date();
    }

    await jobPosting.save();

    res.json({ 
      success: true, 
      message: 'تم تحديث حالة الإعلان بنجاح',
      data: { jobPosting } 
    });
  } catch (error) {
    console.error('Error updating job status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في تحديث حالة الإعلان',
      error: error.message 
    });
  }
};

/**
 * Get job statistics
 * GET /api/recruitment/jobs/stats
 */
const getJobStats = async (req, res) => {
  try {
    const stats = {
      total: await JobPosting.countDocuments(),
      open: await JobPosting.countDocuments({ status: JobPosting.OPEN }),
      closed: await JobPosting.countDocuments({ status: JobPosting.CLOSED }),
      filled: await JobPosting.countDocuments({ status: JobPosting.FILLED }),
      draft: await JobPosting.countDocuments({ status: JobPosting.DRAFT })
    };

    const applications = await CandidateApplication.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({ 
      success: true, 
      data: { 
        postings: stats,
        applications: applications.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {})
      } 
    });
  } catch (error) {
    console.error('Error fetching job stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في جلب الإحصائيات',
      error: error.message 
    });
  }
};

/**
 * ===========================
 * CANDIDATE APPLICATION CONTROLLERS
 * ===========================
 */

/**
 * Create candidate application
 * POST /api/recruitment/applications
 */
const createApplication = async (req, res) => {
  try {
    const { jobPostingId, cvUrl } = req.body;

    // Verify job posting exists and is open
    const jobPosting = await JobPosting.findById(jobPostingId);
    if (!jobPosting) {
      return res.status(404).json({ 
        success: false, 
        message: 'إعلان الوظيفة غير موجود' 
      });
    }

    if (jobPosting.status !== JobPosting.OPEN) {
      return res.status(403).json({ 
        success: false, 
        message: 'هذا الإعلان غير مفتوح للتقديم' 
      });
    }

    // Check max applicants
    if (jobPosting.maxApplicants > 0) {
      const applicationCount = await CandidateApplication.countDocuments({ 
        jobPosting: jobPostingId 
      });
      if (applicationCount >= jobPosting.maxApplicants) {
        return res.status(403).json({ 
          success: false, 
          message: 'تم الوصول للحد الأقصى للمرشحين' 
        });
      }
    }

    // Check if already applied (by email)
    const existingApplication = await CandidateApplication.findOne({
      email: req.body.email,
      jobPosting: jobPostingId
    });

    if (existingApplication) {
      return res.status(409).json({ 
        success: false, 
        message: 'لقد قمت بالتقديم لهذه الوظيفة مسبقاً' 
      });
    }

    // Create application
    const application = await CandidateApplication.create({
      jobPosting: jobPostingId,
      applicantName: req.body.applicantName,
      email: req.body.email,
      phone: req.body.phone,
      cvUrl: cvUrl,
      coverLetter: req.body.coverLetter,
      experience: req.body.experience,
      education: req.body.education,
      skills: req.body.skills,
      source: req.body.source,
      currentStage: 'screening'
    });

    // Update job posting application count
    jobPosting.applications += 1;
    await jobPosting.save();

    // Notify hiring manager
    await Notification.createNotification(
      jobPosting.hiringManager,
      NotificationType.RECRUITMENT,
      'طلب توظيف جديد',
      `تلقى الإعلان "${jobPosting.title}" طلب توظيف جديد من ${req.body.applicantName}`,
      null
    );

    res.status(201).json({ 
      success: true, 
      message: 'تم تقديم الطلب بنجاح',
      data: { application } 
    });
  } catch (error) {
    console.error('Error creating application:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في تقديم الطلب',
      error: error.message 
    });
  }
};

/**
 * Get applications (admin/manager)
 * GET /api/recruitment/applications
 */
const getApplications = async (req, res) => {
  try {
    const {
      status,
      jobPostingId,
      department,
      search,
      page = 1,
      limit = 20
    } = req.query;

    const query = {};
    
    if (status) query.status = status;
    if (jobPostingId) query.jobPosting = jobPostingId;
    
    if (search) {
      query.$or = [
        { applicantName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (department) {
      const deptDoc = await Department.findOne({ name: department });
      if (!deptDoc) {
        return res.status(404).json({
          success: false,
          message: 'القسم غير موجود'
        });
      }
      const jobPostings = await JobPosting.find({
        department: deptDoc._id
      }).select('_id');
      query.jobPosting = { $in: jobPostings.map(j => j._id) };
    }

    if (req.user.role === 'manager') {
      const user = await User.findById(req.user._id);
      if (user?.department) {
        const deptDoc = await Department.findOne({ name: user.department });
        if (deptDoc) {
          const jobPostings = await JobPosting.find({
            department: deptDoc._id
          }).select('_id');
          query.jobPosting = { $in: jobPostings.map(j => j._id) };
        }
      }
    }

    const skip = (page - 1) * limit;
    
    const applications = await CandidateApplication.find(query)
      .populate('jobPosting', 'title department')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await CandidateApplication.countDocuments(query);

    res.json({ 
      success: true, 
      data: {
        applications,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total
        }
      }
    });
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في جلب الطلبات',
      error: error.message 
    });
  }
};

/**
 * Update application status
 * PUT /api/recruitment/applications/:id/status
 */
const updateApplicationStatus = async (req, res) => {
  try {
    const { status, stage, notes, rejectionReason } = req.body;
    const application = await CandidateApplication.findById(req.params.id)
      .populate('jobPosting');

    if (!application) {
      return res.status(404).json({ 
        success: false, 
        message: 'الطلب غير موجود' 
      });
    }

    // Check permissions
    const jobPosting = await JobPosting.findById(application.jobPosting);
    if (jobPosting.hiringManager.toString() !== req.user._id.toString() && 
        req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'ليس لديك صلاحية تعديل هذا الطلب' 
      });
    }

    // Update status history
    application.statusHistory.push({
      status: status,
      changedBy: req.user._id,
      notes: notes
    });

    application.status = status;
    if (stage) application.currentStage = stage;
    if (rejectionReason) application.rejectionReason = rejectionReason;

    await application.save();

    // Notify applicant
    await Notification.createNotification(
      null, // No user account yet
      NotificationType.RECRUITMENT,
      'تحديث حالة الطلب',
      `تم تحديث حالة طلبك للوظيفة "${jobPosting.title}" إلى ${status}`,
      null
    );

    res.json({ 
      success: true, 
      message: 'تم تحديث حالة الطلب بنجاح',
      data: { application } 
    });
  } catch (error) {
    console.error('Error updating application status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في تحديث حالة الطلب',
      error: error.message 
    });
  }
};

/**
 * Add interview feedback
 * POST /api/recruitment/applications/:id/feedback
 */
const addInterviewFeedback = async (req, res) => {
  try {
    const { stage, rating, feedback, recommendation } = req.body;
    const application = await CandidateApplication.findById(req.params.id);

    if (!application) {
      return res.status(404).json({ 
        success: false, 
        message: 'الطلب غير موجود' 
      });
    }

    application.interviewNotes.push({
      stage,
      interviewer: req.user._id,
      rating,
      feedback,
      recommendation
    });

    // Update overall rating
    const totalRatings = application.interviewNotes.reduce((sum, note) => {
      return sum + (note.rating || 0);
    }, 0);
    application.overallRating = totalRatings / application.interviewNotes.length;

    await application.save();

    res.json({ 
      success: true, 
      message: 'تمت إضافة التقييم بنجاح',
      data: { application } 
    });
  } catch (error) {
    console.error('Error adding feedback:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في إضافة التقييم',
      error: error.message 
    });
  }
};

/**
 * ===========================
 * PERFORMANCE REVIEW CONTROLLERS
 * ===========================
 */

/**
 * Create performance review
 * POST /api/performance/reviews
 */
const createPerformanceReview = async (req, res) => {
  try {
    const { employee, reviewPeriod, goals } = req.body;

    // Verify employee exists
    const emp = await User.findById(employee);
    if (!emp) {
      return res.status(404).json({ 
        success: false, 
        message: 'الموظف غير موجود' 
      });
    }

    // Check for existing review in this period
    const existingReview = await PerformanceReview.findOne({
      employee,
      'reviewPeriod.year': reviewPeriod.year,
      'reviewPeriod.period': reviewPeriod.period
    });

    if (existingReview) {
      return res.status(409).json({ 
        success: false, 
        message: 'يوجد تقييم أداء لهذا الموظف في هذه الفترة' 
      });
    }

    // Determine reviewer (manager for employee, or HR/admin)
    let reviewer = req.user._id;
    if (req.user.role === 'admin' || req.user.role === 'general_manager') {
      reviewer = req.user._id;
    } else if (req.user.role === 'manager' && emp.department === req.user.department) {
      reviewer = req.user._id;
    }

    const review = await PerformanceReview.create({
      employee,
      reviewer,
      reviewPeriod: {
        startDate: reviewPeriod.startDate,
        endDate: reviewPeriod.endDate,
        period: reviewPeriod.period,
        year: reviewPeriod.year
      },
      goals: goals || [],
      status: PerformanceReview.DRAFT
    });

    res.status(201).json({ 
      success: true, 
      message: 'تم إنشاء تقييم الأداء بنجاح',
      data: { review } 
    });
  } catch (error) {
    console.error('Error creating performance review:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في إنشاء تقييم الأداء',
      error: error.message 
    });
  }
};

/**
 * Get performance reviews
 * GET /api/performance/reviews
 */
const getPerformanceReviews = async (req, res) => {
  try {
    const {
      employee,
      status,
      period,
      year,
      page = 1,
      limit = 20
    } = req.query;

    const query = {};
    
    if (employee) query.employee = employee;
    if (status) query.status = status;
    if (period) query['reviewPeriod.period'] = period;
    if (year) query['reviewPeriod.year'] = parseInt(year);

    // Filter by department for managers
    if (req.user.role === 'manager') {
      const user = await User.findById(req.user._id);
      if (user?.department) {
        const employees = await User.find({ department: user.department }).select('_id');
        query.employee = { $in: employees.map(e => e._id) };
      }
    }

    // Employees can only view their own reviews
    if (req.user.role === 'employee') {
      query.employee = req.user._id;
    }

    const skip = (page - 1) * limit;
    
    const reviews = await PerformanceReview.find(query)
      .populate('employee', 'name username email')
      .populate('reviewer', 'name username')
      .populate('kpiScores.kpi', 'name category')
      .sort({ 'reviewPeriod.year': -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await PerformanceReview.countDocuments(query);

    res.json({ 
      success: true, 
      data: {
        reviews,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total
        }
      }
    });
  } catch (error) {
    console.error('Error fetching performance reviews:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في جلب تقييمات الأداء',
      error: error.message 
    });
  }
};

/**
 * Submit self assessment
 * PUT /api/performance/reviews/:id/self-assessment
 */
const submitSelfAssessment = async (req, res) => {
  try {
    const review = await PerformanceReview.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ 
        success: false, 
        message: 'تقييم الأداء غير موجود' 
      });
    }

    // Check if employee owns this review
    if (review.employee.toString() !== req.user._id.toString() && 
        req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'ليس لديك صلاحية تعديل هذا التقييم' 
      });
    }

    review.selfAssessment = {
      submitted: true,
      submittedAt: new Date(),
      strengths: req.body.strengths,
      areasForImprovement: req.body.areasForImprovement,
      goals: req.body.goals
    };

    await review.save();

    res.json({ 
      success: true, 
      message: 'تم تقديم التقييم الذاتي بنجاح',
      data: { review } 
    });
  } catch (error) {
    console.error('Error submitting self assessment:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في تقديم التقييم الذاتي',
      error: error.message 
    });
  }
};

/**
 * Submit manager assessment
 * PUT /api/performance/reviews/:id/manager-assessment
 */
const submitManagerAssessment = async (req, res) => {
  try {
    const review = await PerformanceReview.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ 
        success: false, 
        message: 'تقييم الأداء غير موجود' 
      });
    }

    // Check if reviewer is authorized)
    if (review.reviewer.toString() !== req.user._id.toString() && 
        req.user.role !== 'admin' && 
        req.user.role !== 'general_manager') {
      return res.status(403).json({ 
        success: false, 
        message: 'ليس لديك صلاحية تقديم تقييم الأداء' 
      });
    }

    review.managerAssessment = {
      ...req.body,
      submitted: true,
      submittedAt: new Date()
    };

    review.status = PerformanceReview.COMPLETED;

    await review.save();

    // Notify employee
    await Notification.createNotification(
      review.employee,
      NotificationType.PERFORMANCE,
      'تم إكمال تقييم الأداء',
      'تم إكمال تقييم الأداء الخاص بك',
      null
    );

    res.json({ 
      success: true, 
      message: 'تم تقديم تقييم الأداء بنجاح',
      data: { review } 
    });
  } catch (error) {
    console.error('Error submitting manager assessment:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في تقديم تقييم الأداء',
      error: error.message 
    });
  }
};

/**
 * Add peer feedback
 * POST /api/performance/reviews/:id/peer-feedback
 */
const addPeerFeedback = async (req, res) => {
  try {
    const review = await PerformanceReview.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ 
        success: false, 
        message: 'تقييم الأداء غير موجود' 
      });
    }

    // Check if employee is in same department (for peer feedback)
    const reviewer = await User.findById(req.user._id);
    const employee = await User.findById(review.employee);
    
    if (reviewer.department !== employee.department && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'يمكن تقديم التقييم فقط للزملاء في نفس القسم' 
      });
    }

    review.peerFeedback.push({
      submittedBy: req.user._id,
      rating: req.body.rating,
      comments: req.body.comments,
      isAnonymous: req.body.isAnonymous !== false
    });

    await review.save();

    res.json({ 
      success: true, 
      message: 'تم إضافة التقييم بنجاح',
      data: { review } 
    });
  } catch (error) {
    console.error('Error adding peer feedback:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في إضافة التقييم',
      error: error.message 
    });
  }
};

/**
 * Submit promotion recommendation
 * PUT /api/performance/reviews/:id/promotion
 */
const submitPromotionRecommendation = async (req, res) => {
  try {
    const review = await PerformanceReview.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ 
        success: false, 
        message: 'تقييم الأداء غير موجود' 
      });
    }

    // Only admin or general_manager can submit promotion
    if (req.user.role !== 'admin' && req.user.role !== 'general_manager') {
      return res.status(403).json({ 
        success: false, 
        message: 'ليس لديك صلاحية تقديم توصية الترقية' 
      });
    }

    review.promotionRecommendation = {
      recommended: req.body.recommended,
      level: req.body.level,
      justification: req.body.justification,
      salaryIncrease: req.body.salaryIncrease,
      recommendedBy: req.user._id,
      recommendedAt: new Date()
    };

    await review.save();

    // Notify HR/admins
    const admins = await User.find({ role: 'admin' });
    for (const admin of admins) {
      await Notification.createNotification(
        admin._id,
        NotificationType.PROMOTION,
        'توصية ترقية جديدة',
        `تم تقديم توصية ترقية لموظف ${review.employee.toString()}`,
        null
      );
    }

    res.json({ 
      success: true, 
      message: 'تم تقديم توصية الترقية بنجاح',
      data: { review } 
    });
  } catch (error) {
    console.error('Error submitting promotion recommendation:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في تقديم توصية الترقية',
      error: error.message 
    });
  }
};

/**
 * Approve performance review
 * PUT /api/performance/reviews/:id/approve
 */
const approvePerformanceReview = async (req, res) => {
  try {
    const review = await PerformanceReview.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ 
        success: false, 
        message: 'تقييم الأداء غير موجود' 
      });
    }

    // Only admin can approve
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'فقط المدير العام يمكنه الموافقة على تقييم الأداء' 
      });
    }

    review.status = PerformanceReview.APPROVED;
    review.approvedBy = req.user._id;
    review.approvedAt = new Date();

    await review.save();

    res.json({ 
      success: true, 
      message: 'تمت الموافقة على تقييم الأداء بنجاح',
      data: { review } 
    });
  } catch (error) {
    console.error('Error approving performance review:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في الموافقة على تقييم الأداء',
      error: error.message 
    });
  }
};

/**
 * =================
 * KPI CONTROLLERS
 * =================
 */

/**
 * Create KPI
 * POST /api/performance/kpis
 */
const createKPI = async (req, res) => {
  try {
    const { name, description, category, metric, unit, target, targetType, applicableRoles } = req.body;

    const kpi = await KPI.create({
      name,
      description,
      category,
      metric,
      unit,
      target,
      targetType,
      applicableRoles: applicableRoles || ['employee'],
      createdBy: req.user._id,
      isActive: true
    });

    res.status(201).json({ 
      success: true, 
      message: 'تم إنشاء المؤشر بنجاح',
      data: { kpi } 
    });
  } catch (error) {
    console.error('Error creating KPI:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في إنشاء المؤشر',
      error: error.message 
    });
  }
};

/**
 * Get KPIs
 * GET /api/performance/kpis
 */
const getKPIs = async (req, res) => {
  try {
    const { category, isActive, role } = req.query;

    const query = {};
    if (category) query.category = category;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (role) query.applicableRoles = role;

    const kpis = await KPI.find(query).sort({ createdAt: -1 });

    res.json({ success: true, data: { kpis } });
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في جلب المؤشرات',
      error: error.message 
    });
  }
};

/**
 * Update KPI
 * PUT /api/performance/kpis/:id
 */
const updateKPI = async (req, res) => {
  try {
    const kpi = await KPI.findById(req.params.id);

    if (!kpi) {
      return res.status(404).json({ 
        success: false, 
        message: 'المؤشر غير موجود' 
      });
    }

    const updates = req.body;
    Object.keys(updates).forEach(key => {
      if (key !== '_id') {
        kpi[key] = updates[key];
      }
    });

    await kpi.save();

    res.json({ 
      success: true, 
      message: 'تم تحديث المؤشر بنجاح',
      data: { kpi } 
    });
  } catch (error) {
    console.error('Error updating KPI:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في تحديث المؤشر',
      error: error.message 
    });
  }
};

/**
 * Delete KPI
 * DELETE /api/performance/kpis/:id
 */
const deleteKPI = async (req, res) => {
  try {
    const kpi = await KPI.findById(req.params.id);

    if (!kpi) {
      return res.status(404).json({ 
        success: false, 
        message: 'المؤشر غير موجود' 
      });
    }

    await kpi.deleteOne();

    res.json({ 
      success: true, 
      message: 'تم حذف المؤشر بنجاح' 
    });
  } catch (error) {
    console.error('Error deleting KPI:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في حذف المؤشر',
      error: error.message 
    });
  }
};

module.exports = {
  // Job Posting Controllers
  createJobPosting,
  getJobPostings,
  getJobPosting,
  updateJobPosting,
  deleteJobPosting,
  updateJobStatus,
  getJobStats,
  
  // Candidate Application Controllers
  createApplication,
  getApplications,
  updateApplicationStatus,
  addInterviewFeedback,
  
  // Performance Review Controllers
  createPerformanceReview,
  getPerformanceReviews,
  submitSelfAssessment,
  submitManagerAssessment,
  addPeerFeedback,
  submitPromotionRecommendation,
  approvePerformanceReview,
  
  // KPI Controllers
  createKPI,
  getKPIs,
  updateKPI,
  deleteKPI
};
