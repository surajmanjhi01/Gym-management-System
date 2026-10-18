const mongoose = require('mongoose');

const gymSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    contact: {
      phone: { type: String, required: true, trim: true },
      email: { type: String, required: true, lowercase: true, trim: true },
    },
    timezone: { type: String, default: 'Asia/Kolkata' },
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: ['active', 'trialing', 'suspended'], default: 'trialing' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Gym', gymSchema);