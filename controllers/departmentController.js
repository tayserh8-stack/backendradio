const Department = require('../models/Department');

const STATIC_DEPARTMENTS = ['production', 'news', 'marketing'];

exports.getAllDepartments = async (req, res) => {
  try {
    const customDepartments = await Department.find().sort({ createdAt: -1 });
    const staticDepts = STATIC_DEPARTMENTS.map(name => ({ name, _id: name, isStatic: true }));
    const allDepartments = [...staticDepts, ...customDepartments];
    res.json({
      success: true,
      data: { departments: allDepartments, totalCount: allDepartments.length }
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
    const { name, color } = req.body;
    
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
      color: color || '#3B82F6'
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

exports.deleteDepartment = async (req, res) => {
  try {
    const department = await Department.findByIdAndDelete(req.params.id);
    
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'القسم غير موجود'
      });
    }

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