const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
    memberCode: { type: String, required: true },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true, default: null },
    gender: { type: String, enum: ['male', 'female', 'other'], default: 'other' },
    dateOfBirth: { type: Date, default: null },
    joinedAt: { type: Date, default: Date.now },
    address: {
      line1: { type: String, default: '' },
      city: { type: String, default: '' },
      pincode: { type: String, default: '' },
    },
    emergencyContact: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
      relationship: { type: String, default: '' },
    },
    medicalNotes: { type: String, default: '' },
    status: {
      type: String,
      enum: ['active', 'inactive', 'archived'],
      default: 'active',
      index: true,
    },
    messagingPreferences: {
      whatsappEnabled: { type: Boolean, default: true },
      smsEnabled: { type: Boolean, default: true },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
memberSchema.index({ tenantId: 1, memberCode: 1 }, { unique: true });
memberSchema.index({ tenantId: 1, phone: 1 });
memberSchema.index({ tenantId: 1, fullName: 'text' });

module.exports = mongoose.model('Member', memberSchema);