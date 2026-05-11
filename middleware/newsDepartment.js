const newsDepartmentOnly = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || (req.user.department && req.user.department.toLowerCase() === 'news'))) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'هذه الخدمة متاحة فقط لموظفي قسم الأخبار'
  });
};

const newsManagerOrAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || (req.user.department && req.user.department.toLowerCase() === 'news' && req.user.role === 'manager'))) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'غير مصرح لك بالوصول - هذه الخدمة لمديري الأخبار فقط'
  });
};

module.exports = { newsDepartmentOnly, newsManagerOrAdmin };
