const { z } = require('zod');

const registerMemberSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(10, 'Valid 10-digit phone number is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  gender: z.enum(['male', 'female', 'other']).optional(),
  dateOfBirth: z.string().datetime().optional().nullable(),
  joinedAt: z.string().datetime().optional(),
  address: z
    .object({
      line1: z.string().optional(),
      city: z.string().optional(),
      pincode: z.string().optional(),
    })
    .optional(),
  emergencyContact: z
    .object({
      name: z.string().optional(),
      phone: z.string().optional(),
      relationship: z.string().optional(),
    })
    .optional(),
  medicalNotes: z.string().optional(),
});

const updateMemberSchema = registerMemberSchema.partial();

module.exports = { registerMemberSchema, updateMemberSchema };