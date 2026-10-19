const { z } = require('zod');

const createEnquirySchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(10, 'Valid 10-digit phone number is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  gender: z.enum(['male', 'female', 'other']).optional(),
  source: z.enum(['walk_in', 'instagram', 'google_maps', 'referral', 'whatsapp', 'website', 'other']).optional(),
  interestedPlanId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid plan ID').optional().nullable(),
  nextFollowUpDate: z.string().datetime().optional().nullable(),
  trialDate: z.string().datetime().optional().nullable(),
  assignedStaff: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid staff user ID').optional().nullable(),
  notes: z.string().optional().default(''),
});

const addFollowUpSchema = z.object({
  notes: z.string().min(2, 'Follow-up notes required'),
  outcome: z.enum(['pending', 'interested', 'call_back_later', 'price_too_high', 'not_interested', 'trial_booked']),
  nextFollowUpDate: z.string().datetime().optional().nullable(),
  trialDate: z.string().datetime().optional().nullable(),
  status: z.enum(['follow_up_scheduled', 'trial_active', 'lost']).optional(),
});

const convertProspectSchema = z.object({
  planId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid plan ID'),
  startDate: z.string().datetime().optional(),
  discountPaise: z.number().int().min(0).optional().default(0),
  paidAmountPaise: z.number().int().min(0).optional().default(0),
  paymentMethod: z.enum(['cash', 'upi', 'card', 'bank_transfer']).optional().default('cash'),
});

module.exports = { createEnquirySchema, addFollowUpSchema, convertProspectSchema };