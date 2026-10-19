const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    amountPaise: { type: Number, required: true, min: 100 }, // Minimum ₹1
    currency: { type: String, default: 'INR' },
    method: {
      type: String,
      enum: ['cash', 'upi', 'card', 'bank_transfer', 'cheque'],
      required: true,
    },
    transactionRef: { type: String, default: '' }, // UPI UTR, Cheque number, etc.
    notes: { type: String, default: '' },
    receivedAt: { type: Date, default: Date.now },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

paymentSchema.index({ tenantId: 1, receivedAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);