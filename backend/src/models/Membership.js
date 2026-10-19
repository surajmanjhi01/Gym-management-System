const mongoose = require('mongoose');

const freezePeriodSchema = new mongoose.Schema(
  {
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    daysFrozen: { type: Number, default: 0 },
    reason: { type: String, default: '' },
    frozenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const membershipSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'MembershipPlan', required: true },
    planSnapshot: {
      name: { type: String, required: true },
      duration: {
        value: { type: Number, required: true },
        unit: { type: String, required: true },
      },
      pricePaise: { type: Number, required: true },
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['scheduled', 'active', 'frozen', 'expired', 'cancelled'],
      default: 'active',
      index: true,
    },
    freezeHistory: [freezePeriodSchema],
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// High-frequency index for renewal reminders and dashboard expiries
membershipSchema.index({ tenantId: 1, status: 1, endDate: 1 });
membershipSchema.index({ tenantId: 1, memberId: 1, endDate: -1 });

module.exports = mongoose.model('Membership', membershipSchema);