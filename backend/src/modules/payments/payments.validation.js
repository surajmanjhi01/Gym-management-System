const { z } = require('zod');

const createChargeSchema = z.object({
  memberId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid member ID'),
  membershipId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid membership ID').optional(),
  title: z.string().min(2, 'Charge title is required'),
  type: z.enum(['membership_fee', 'joining_fee', 'personal_training', 'locker', 'penalty', 'other']).optional(),
  baseAmountPaise: z.number().int().min(0, 'Base amount must be non-negative paise'),
  discountPaise: z.number().int().min(0).optional().default(0),
  dueDate: z.string().datetime().optional(),
});

const recordPaymentSchema = z.object({
  memberId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid member ID'),
  amountPaise: z.number().int().min(100, 'Minimum payment is ₹1 (100 paise)'),
  method: z.enum(['cash', 'upi', 'card', 'bank_transfer', 'cheque']),
  transactionRef: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  chargeId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid charge ID').optional(),
});

module.exports = { createChargeSchema, recordPaymentSchema };