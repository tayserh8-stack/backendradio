const { User } = require('../models/User');
const path = require('path');
const fs = require('fs');
const { decodeFileName } = require('../middleware/cvUploadMiddleware');

const getEmployeeProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }

    res.json({
      success: true,
      data: { user: user.getPublicProfile() }
    });
  } catch (error) {
    console.error('خطأ في جلب ملف الموظف:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

const updateEmployeeProfile = async (req, res) => {
  try {
    const {
      jobTitle, nationalId, dateOfBirth, placeOfBirth, nationality,
      gender, maritalStatus, address, emergencyContactName,
      emergencyContactPhone, emergencyContactRelation, education,
      specialization, yearsOfExperience, previousEmployer,
      bankAccountNumber, bankName, taxNumber, socialSecurityNumber, notes,
      phone, baseSalary, housingAllowance, transportAllowance,
      otherAllowances, bonus, overtime, socialInsurance, tax,
      otherDeductions, hoursShortfall
    } = req.body;

    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }

    if (jobTitle !== undefined) user.jobTitle = jobTitle;
    if (nationalId !== undefined) user.nationalId = nationalId;
    if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth;
    if (placeOfBirth !== undefined) user.placeOfBirth = placeOfBirth;
    if (nationality !== undefined) user.nationality = nationality;
    if (gender !== undefined) user.gender = gender;
    if (maritalStatus !== undefined) user.maritalStatus = maritalStatus;
    if (address !== undefined) user.address = address;
    if (emergencyContactName !== undefined) user.emergencyContactName = emergencyContactName;
    if (emergencyContactPhone !== undefined) user.emergencyContactPhone = emergencyContactPhone;
    if (emergencyContactRelation !== undefined) user.emergencyContactRelation = emergencyContactRelation;
    if (education !== undefined) user.education = education;
    if (specialization !== undefined) user.specialization = specialization;
    if (yearsOfExperience !== undefined) user.yearsOfExperience = Number(yearsOfExperience);
    if (previousEmployer !== undefined) user.previousEmployer = previousEmployer;
    if (bankAccountNumber !== undefined) user.bankAccountNumber = bankAccountNumber;
    if (bankName !== undefined) user.bankName = bankName;
    if (taxNumber !== undefined) user.taxNumber = taxNumber;
    if (socialSecurityNumber !== undefined) user.socialSecurityNumber = socialSecurityNumber;
    if (notes !== undefined) user.notes = notes;
    if (phone !== undefined) user.phone = phone;
    if (baseSalary !== undefined) user.baseSalary = Number(baseSalary);
    if (housingAllowance !== undefined) user.housingAllowance = Number(housingAllowance);
    if (transportAllowance !== undefined) user.transportAllowance = Number(transportAllowance);
    if (otherAllowances !== undefined) user.otherAllowances = Number(otherAllowances);
    if (bonus !== undefined) user.bonus = Number(bonus);
    if (overtime !== undefined) user.overtime = Number(overtime);
    if (socialInsurance !== undefined) user.socialInsurance = Number(socialInsurance);
    if (tax !== undefined) user.tax = Number(tax);
    if (otherDeductions !== undefined) user.otherDeductions = Number(otherDeductions);
    if (hoursShortfall !== undefined) user.hoursShortfall = Number(hoursShortfall);

    await user.save();

    res.json({
      success: true,
      message: 'تم تحديث بيانات الموظف بنجاح',
      data: { user: user.getPublicProfile() }
    });
  } catch (error) {
    console.error('خطأ في تحديث ملف الموظف:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

const uploadCV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'يرجى رفع ملف السيرة الذاتية'
      });
    }

    const user = await User.findById(req.params.id);
    
    if (!user) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }

    if (user.cvUrl) {
      const oldPath = path.join(__dirname, '..', user.cvUrl.replace('/uploads', ''));
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const decodedFileName = decodeFileName(req.file.originalname);

    const ext = decodedFileName.substring(decodedFileName.lastIndexOf('.'));
    const newFileName = `cv-${user._id}-${Date.now()}${ext}`;
    const newPath = path.join(__dirname, '..', 'uploads', 'cv', newFileName);
    fs.renameSync(req.file.path, newPath);

    user.cvUrl = `/uploads/cv/${newFileName}`;
    user.cvFileName = decodedFileName;
    user.cvUploadedAt = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'تم رفع السيرة الذاتية بنجاح',
      data: {
        cvUrl: user.cvUrl,
        cvFileName: user.cvFileName,
        cvUploadedAt: user.cvUploadedAt
      }
    });
  } catch (error) {
    console.error('خطأ في رفع السيرة الذاتية:', error.message);
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
    }
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

const deleteCV = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'الموظف غير موجود'
      });
    }

    if (user.cvUrl) {
      const filePath = path.join(__dirname, '..', user.cvUrl.replace('/uploads', ''));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    user.cvUrl = null;
    user.cvFileName = null;
    user.cvUploadedAt = null;
    await user.save();

    res.json({
      success: true,
      message: 'تم حذف السيرة الذاتية بنجاح'
    });
  } catch (error) {
    console.error('خطأ في حذف السيرة الذاتية:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

module.exports = {
  getEmployeeProfile,
  updateEmployeeProfile,
  uploadCV,
  deleteCV
};
