const mongoose = require('mongoose');

const chargeSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    membershipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', default: null },
    title: { type: String, required: true }, // e.g., "Monthly Gym Fee", "Locker Charge"
    type: {
      type: String,
      enum: ['membership_fee', 'joining_fee', 'personal_training', 'locker', 'penalty', 'other'],
      default: 'membership_fee',
    },
    currency: { type: String, default: 'INR' },
    baseAmountPaise: { type: Number, required: true, min: 0 },
    discountPaise: { type: Number, default: 0, min: 0 },
    finalAmountPaise: { type: Number, required: true, min: 0 }, // base - discount
    paidAmountPaise: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['unpaid', 'partially_paid', 'paid', 'void'],
      default: 'unpaid',
      index: true,
    },
    dueDate: { type: Date, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

chargeSchema.index({ tenantId: 1, status: 1, dueDate: 1 });
chargeSchema.index({ tenantId: 1, memberId: 1, status: 1 });

module.exports = mongoose.model('Charge', chargeSchema);