const newsDepartmentOnly = (req, res, next) => {
  const role = req.user?.role?.toLowerCase() || '';
  const dept = req.user?.department?.toLowerCase() || '';
  if (role === 'admin' || (dept === 'news')) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'هذه الخدمة متاحة فقط لموظفي قسم الأخبار'
  });
};

const newsManagerOrAdmin = (req, res, next) => {
  const role = req.user?.role?.toLowerCase() || '';
  const dept = req.user?.department?.toLowerCase() || '';
  if (role === 'admin' || (dept === 'news' && role === 'manager')) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'غير مصرح لك بالوصول - هذه الخدمة لمديري الأخبار فقط'
  });
};

module.exports = { newsDepartmentOnly, newsManagerOrAdmin };
