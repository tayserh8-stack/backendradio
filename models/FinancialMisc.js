const mongoose = require('mongoose');

const financialMiscSchema = new mongoose.Schema({
  number: { type: Number, required: true },
  description: { type: String, required: true, trim: true },
  date: { type: Date, required: true, default: Date.now },
  amount: { type: Number, required: true },
  notes: { type: String, trim: true, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive: { type: Boolean, default: true },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

financialMiscSchema.index({ number: 1 });
financialMiscSchema.index({ date: -1 });

module.exports = mongoose.model('FinancialMisc', financialMiscSchema);
