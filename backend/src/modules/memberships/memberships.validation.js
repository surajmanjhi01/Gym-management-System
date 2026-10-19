const { z } = require('zod');

const createPlanSchema = z.object({
  name: z.string().min(2, 'Plan name must be at least 2 characters'),
  description: z.string().optional(),
  duration: z.object({
    value: z.number().int().min(1, 'Duration must be at least 1'),
    unit: z.enum(['day', 'month', 'year']),
  }),
  pricePaise: z.number().int().min(0, 'Price must be in paise (non-negative)'),
  joiningFeePaise: z.number().int().min(0).optional(),
});

const assignMembershipSchema = z.object({
  memberId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid member ID'),
  planId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid plan ID'),
  startDate: z.string().datetime().optional(), // Defaults to now
});

const freezeMembershipSchema = z.object({
  reason: z.string().optional(),
});

module.exports = {
  createPlanSchema,
  assignMembershipSchema,
  freezeMembershipSchema,
};