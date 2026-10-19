const mongoose = require('mongoose');

const receiptSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
    receiptNumber: { type: String, required: true }, // e.g. "REC-00001", unique per gym
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true },
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    amountPaise: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    paymentMethod: { type: String, required: true },
    gymSnapshot: {
      name: String,
      phone: String,
      email: String,
    },
    memberSnapshot: {
      fullName: String,
      phone: String,
      memberCode: String,
    },
    issuedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

receiptSchema.index({ tenantId: 1, receiptNumber: 1 }, { unique: true });

module.exports = mongoose.model('Receipt', receiptSchema);