const { z } = require('zod');

const deskCheckInSchema = z.object({
  memberCode: z.string().min(3, 'Member code is required').trim(),
  method: z.enum(['manual_desk', 'qr_kiosk', 'biometric']).optional().default('manual_desk'),
});

const qrScanSchema = z.object({
  qrToken: z.string().min(10, 'Valid QR verification token is required'),
});

const attendanceHistoryQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  date: z.string().optional(), // YYYY-MM-DD
  memberId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid member ID').optional(),
  membershipId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid membership ID').optional(),
});

module.exports = { deskCheckInSchema, qrScanSchema, attendanceHistoryQuerySchema };