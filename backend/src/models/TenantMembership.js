const mongoose = require('mongoose');

const tenantMembershipSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: {
      type: String,
      enum: ['owner', 'manager', 'receptionist', 'trainer'],
      default: 'owner',
    },
    status: { type: String, enum: ['active', 'revoked'], default: 'active' },
  },
  { timestamps: true }
);

// Prevent duplicate mappings for the same gym and user
tenantMembershipSchema.index({ tenantId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('TenantMembership', tenantMembershipSchema);