const mongoose = require('mongoose');

const membershipPlanSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
    name: { type: String, required: true, trim: true }, // e.g., "Quarterly Weight Training"
    description: { type: String, default: '' },
    duration: {
      value: { type: Number, required: true, min: 1 },
      unit: { type: String, enum: ['day', 'month', 'year'], required: true },
    },
    pricePaise: { type: Number, required: true, min: 0 }, // e.g. ₹1,500 = 150000 paise
    joiningFeePaise: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

membershipPlanSchema.index({ tenantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('MembershipPlan', membershipPlanSchema);