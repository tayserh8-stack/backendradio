const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/financialMiscController');

router.get('/exchange-rate', protect, ctrl.getExchangeRate);
const isFinancialDept = (dept) => {
  if (!dept) return false;
  const normalized = String(dept).trim().toLowerCase();
  return normalized === 'financial' || normalized === 'المالي';
};

router.put('/exchange-rate', protect, (req, res, next) => {
  if (!isFinancialDept(req.user.department)) {
    return res.status(403).json({ success: false, message: 'غير مصرح لك بتعديل سعر الصرف' });
  }
  next();
}, ctrl.setExchangeRate);

router.get('/', protect, ctrl.getAll);
router.get('/:id', protect, ctrl.getById);
router.post('/', protect, ctrl.create);
router.post('/archive-month', protect, ctrl.archiveMonth);
router.put('/:id', protect, ctrl.update);
router.delete('/:id', protect, ctrl.remove);

module.exports = router;
