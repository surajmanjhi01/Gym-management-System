const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Gym',
      required: true,
      index: true,
    },
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
      index: true,
    },
    membershipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Membership',
      required: true,
    },
    checkInTime: {
      type: Date,
      default: Date.now,
      index: true,
    },
    method: {
      type: String,
      enum: ['qr_dynamic', 'qr_kiosk', 'manual_desk', 'biometric'],
      default: 'manual_desk',
    },
    // Captured snapshot at check-in time for historical reporting
    memberSnapshot: {
      fullName: String,
      memberCode: String,
      phone: String,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// Optimize daily check-in retrieval per gym
attendanceSchema.index({ tenantId: 1, checkInTime: -1 });

// Optimize member history & duplicate check queries
attendanceSchema.index({ tenantId: 1, memberId: 1, checkInTime: -1 });

module.exports = mongoose.model('Attendance', attendanceSchema);