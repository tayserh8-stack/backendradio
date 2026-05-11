const Department = require('../models/Department');
const { Payroll } = require('../models/Payroll');
const { User } = require('../models/User');

const DEFAULT_DEPARTMENTS = [
  { name: 'المالي', color: '#EF4444', description: 'القسم المالي والمحاسبة' },
  { name: 'تقنية المعلومات', color: '#8B5CF6', description: 'قسم تقنية المعلومات' },
  { name: 'التسويق', color: '#F59E0B', description: 'قسم التسويق والعلاقات' },
  { name: 'الأخبار', color: '#10B981', description: 'قسم الأخبار والمحتوى' },
  { name: 'الإنتاج', color: '#3B82F6', description: 'قسم الإنتاج' },
  { name: 'البث المباشر', color: '#06B6D4', description: 'قسم البث المباشر' },
  { name: 'الموارد البشرية', color: '#EC4899', description: 'قسم الموارد البشرية' }
];

exports.seedDefaultDepartments = async () => {
  try {
    for (const dept of DEFAULT_DEPARTMENTS) {
      const existing = await Department.findOne({ name: dept.name });
      if (!existing) {
        await Department.create({ ...dept, isSystem: true });
        console.log(`✅ تم إنشاء القسم الافتراضي: ${dept.name}`);
      }
    }
  } catch (error) {
    console.error('خطأ في إنشاء الأقسام الافتراضية:', error.message);
  }
};

exports.getAllDepartments = async (req, res) => {
  try {
    const departments = await Department.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      data: { departments, totalCount: departments.length }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الأقسام',
      error: error.message
    });
  }
};

exports.createDepartment = async (req, res) => {
  try {
    const { name, color, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'اسم القسم مطلوب'
      });
    }

    const existing = await Department.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'هذا القسم موجود بالفعل'
      });
    }

    const department = await Department.create({
      name: name.trim(),
      color: color || '#3B82F6',
      description: description || '',
      isSystem: false
    });

    res.status(201).json({
      success: true,
      data: { department },
      message: 'تم إنشاء القسم بنجاح'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في إنشاء القسم',
      error: error.message
    });
  }
};

exports.updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, description } = req.body;

    const department = await Department.findById(id);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'القسم غير موجود'
      });
    }

    if (department.isSystem) {
      return res.status(403).json({
        success: false,
        message: 'لا يمكن تعديل قسم نظامي'
      });
    }

    if (name && name.trim() !== department.name) {
      const existing = await Department.findOne({ name: name.trim() });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'هذا الاسم موجود بالفعل'
        });
      }
    }

    if (name) department.name = name.trim();
    if (color) department.color = color;
    if (description !== undefined) department.description = description;

    await department.save();

    res.json({
      success: true,
      data: { department },
      message: 'تم تحديث القسم بنجاح'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في تحديث القسم',
      error: error.message
    });
  }
};

exports.deleteDepartment = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'القسم غير موجود'
      });
    }

    if (department.isSystem) {
      return res.status(403).json({
        success: false,
        message: 'لا يمكن حذف قسم نظامي'
      });
    }

    await Department.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'تم حذف القسم بنجاح'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في حذف القسم',
      error: error.message
    });
  }
};

exports.getDepartmentCosts = async (req, res) => {
  try {
    const departments = await Department.find().sort({ createdAt: -1 });

    const costs = await Payroll.aggregate([
      { $match: { status: { $in: ['approved', 'paid'] } } },
      {
        $lookup: {
          from: 'users',
          localField: 'employee',
          foreignField: '_id',
          as: 'emp'
        }
      },
      { $unwind: { path: '$emp', preserveNullAndEmptyArrays: false } },
      { $match: { 'emp.department': { $ne: null, $ne: '' } } },
      {
        $group: {
          _id: '$emp.department',
          employeeIds: { $addToSet: '$emp._id' },
          totalGross: { $sum: { $ifNull: ['$totals.gross', 0] } },
          totalNet: { $sum: { $ifNull: ['$totals.net', 0] } },
          totalDeductions: { $sum: { $ifNull: ['$totals.deductions', 0] } },
          totalOvertime: { $sum: { $ifNull: ['$components.overtime.totalAmount', 0] } },
          totalPayrolls: { $sum: 1 },
          totalAllowances: {
            $sum: {
              $reduce: {
                input: { $ifNull: ['$components.allowances', []] },
                initialValue: 0,
                in: { $add: ['$$value', { $ifNull: ['$$this.amount', 0] }] }
              }
            }
          },
          totalBonuses: {
            $sum: {
              $reduce: {
                input: { $ifNull: ['$components.bonuses', []] },
                initialValue: 0,
                in: { $add: ['$$value', { $ifNull: ['$$this.amount', 0] }] }
              }
            }
          }
        }
      },
      {
        $project: {
          department: '$_id',
          employeeCount: { $size: '$employeeIds' },
          totalGross: 1,
          totalNet: 1,
          totalDeductions: 1,
          totalOvertime: 1,
          totalAllowances: 1,
          totalBonuses: 1,
          totalPayrolls: 1
        }
      }
    ]);

    const result = departments.map(dept => {
      const cost = costs.find(c => c.department === dept.name);
      return {
        department: dept.name,
        color: dept.color || '#3B82F6',
        employees: cost?.employeeCount || 0,
        payrollGross: cost?.totalGross || 0,
        payrollNet: cost?.totalNet || 0,
        overtime: cost?.totalOvertime || 0,
        benefits: (cost?.totalAllowances || 0) + (cost?.totalBonuses || 0),
        deductions: cost?.totalDeductions || 0,
        payrollCount: cost?.totalPayrolls || 0
      };
    });

    const totalPayroll = result.reduce((sum, d) => sum + d.payrollGross, 0);
    const resultWithPercentage = result.map(d => ({
      ...d,
      percentage: totalPayroll > 0 ? Math.round((d.payrollGross / totalPayroll) * 100) : 0
    }));

    resultWithPercentage.sort((a, b) => b.payrollGross - a.payrollGross);

    res.json({
      success: true,
      data: { departmentCosts: resultWithPercentage, totalPayroll }
    });
  } catch (error) {
    console.error('خطأ في جلب توزيع تكاليف الأقسام:', error.message);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب توزيع تكاليف الأقسام',
      error: error.message
    });
  }
};