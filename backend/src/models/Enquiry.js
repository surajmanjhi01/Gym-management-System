const mongoose = require('mongoose');

const followUpLogSchema = new mongoose.Schema(
  {
    scheduledAt: { type: Date, required: true },
    contactedAt: { type: Date, default: null },
    notes: { type: String, required: true, trim: true },
    outcome: {
      type: String,
      enum: ['pending', 'interested', 'call_back_later', 'price_too_high', 'not_interested', 'trial_booked'],
      default: 'pending',
    },
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

const enquirySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Gym',
      required: true,
      index: true,
    },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true, default: null },
    gender: { type: String, enum: ['male', 'female', 'other'], default: 'other' },
    source: {
      type: String,
      enum: ['walk_in', 'instagram', 'google_maps', 'referral', 'whatsapp', 'website', 'other'],
      default: 'walk_in',
    },
    interestedPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MembershipPlan',
      default: null,
    },
    status: {
      type: String,
      enum: ['new', 'follow_up_scheduled', 'trial_active', 'converted', 'lost'],
      default: 'new',
      index: true,
    },
    nextFollowUpDate: { type: Date, default: null, index: true },
    trialDate: { type: Date, default: null },
    assignedStaff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    convertedMemberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null },
    conversionDate: { type: Date, default: null },
    followUps: [followUpLogSchema],
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// High-speed indices for staff daily follow-up queues and prospect duplicate checks
enquirySchema.index({ tenantId: 1, status: 1, nextFollowUpDate: 1 });
enquirySchema.index({ tenantId: 1, phone: 1 });

module.exports = mongoose.model('Enquiry', enquirySchema);