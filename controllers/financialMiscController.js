const FinancialMisc = require('../models/FinancialMisc');

exports.getAll = async (req, res) => {
  try {
    const { page = 1, limit = 500, sort = '-date', startDate, endDate, type, archived } = req.query;
    const filter = { isActive: true };
    if (type && ['income', 'expense'].includes(type)) filter.type = type;
    if (archived === 'true') filter.archived = true;
    else if (archived === 'false') filter.archived = false;
    else if (archived === undefined) filter.archived = { $ne: true };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }
    const items = await FinancialMisc.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('createdBy', 'name username')
      .populate('updatedBy', 'name username');
    const total = await FinancialMisc.countDocuments(filter);
    const totals = await FinancialMisc.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $ifNull: ['$type', 'expense'] },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);
    const incomeTotal = totals.find(t => t._id === 'income')?.total || 0;
    const expenseTotal = totals.find(t => t._id === 'expense')?.total || 0;
    res.json({
      success: true,
      data: {
        items, total, page: Number(page),
        incomeTotal, expenseTotal, netTotal: incomeTotal - expenseTotal
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const item = await FinancialMisc.findById(req.params.id)
      .populate('createdBy', 'name username')
      .populate('updatedBy', 'name username');
    if (!item) return res.status(404).json({ success: false, message: 'غير موجود' });
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const last = await FinancialMisc.findOne().sort({ number: -1 });
    const data = { ...req.body, number: (last?.number || 0) + 1, createdBy: req.user._id };
    const item = await FinancialMisc.create(data);
    res.status(201).json({ success: true, data: item, message: 'تمت الإضافة بنجاح' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const item = await FinancialMisc.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'غير موجود' });
    Object.assign(item, req.body, { updatedBy: req.user._id });
    await item.save();
    res.json({ success: true, data: item, message: 'تم التحديث بنجاح' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const item = await FinancialMisc.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'غير موجود' });
    item.isActive = false;
    item.updatedBy = req.user._id;
    await item.save();
    res.json({ success: true, message: 'تم الحذف بنجاح' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.archiveMonth = async (req, res) => {
  try {
    const { month } = req.body;
    if (!month) return res.status(400).json({ success: false, message: 'يرجى تحديد الشهر' });
    const d = new Date(month);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const result = await FinancialMisc.updateMany(
      { isActive: true, archived: { $ne: true }, date: { $gte: start, $lte: end } },
      { $set: { archived: true, updatedBy: req.user._id } }
    );
    res.json({ success: true, message: `تم أرشفة ${result.modifiedCount} قيد` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};