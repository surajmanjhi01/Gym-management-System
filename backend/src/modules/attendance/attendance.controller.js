const jwt = require('jsonwebtoken');
const Attendance = require('../../models/Attendance');
const Member = require('../../models/Member');
const Membership = require('../../models/Membership');
const {
  deskCheckInSchema,
  qrScanSchema,
  attendanceHistoryQuerySchema,
} = require('./attendance.validation');

// Helper to check member active plan and duplicate scans
async function validateAndProcessCheckIn({ tenantId, memberId, method, recordedByUserId }) {
  const now = new Date();

  // 1. Fetch active member
  const member = await Member.findOne({ _id: memberId, tenantId, status: 'active' });
  if (!member) {
    const error = new Error('Member not found or account is deactivated');
    error.statusCode = 404;
    error.code = 'MEMBER_NOT_FOUND';
    throw error;
  }

  // 2. Fetch active membership (start <= now <= end)
  const activeMembership = await Membership.findOne({
    tenantId,
    memberId: member._id,
    status: 'active',
    startDate: { $lte: now },
    endDate: { $gte: now },
  });

  if (!activeMembership) {
    const error = new Error('No active membership plan found. Plan is expired or frozen.');
    error.statusCode = 403;
    error.code = 'MEMBERSHIP_INACTIVE';
    throw error;
  }

  // 3. Duplicate check-in check: 2-hour cooldown window
  const cooldownHours = 2;
  const cooldownThreshold = new Date(now.getTime() - cooldownHours * 60 * 60 * 1000);

  const duplicateCheckIn = await Attendance.findOne({
    tenantId,
    memberId: member._id,
    checkInTime: { $gte: cooldownThreshold },
  }).sort({ checkInTime: -1 });

  if (duplicateCheckIn) {
    const lastCheckTime = new Date(duplicateCheckIn.checkInTime).toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
    });
    const error = new Error(`Already checked in recently at ${lastCheckTime}`);
    error.statusCode = 409;
    error.code = 'DUPLICATE_CHECKIN';
    throw error;
  }

  // 4. Record attendance
  const record = await Attendance.create({
    tenantId,
    memberId: member._id,
    membershipId: activeMembership._id,
    method,
    memberSnapshot: {
      fullName: member.fullName,
      memberCode: member.memberCode,
      phone: member.phone,
    },
    recordedBy: recordedByUserId || null,
    checkInTime: now,
  });

  return {
    record,
    member,
    membership: activeMembership,
  };
}

// 1. Desk/Kiosk Check-in by Member Code
exports.deskCheckIn = async (req, res, next) => {
  try {
    const { memberCode, method } = deskCheckInSchema.parse(req.body);

    const member = await Member.findOne({
      tenantId: req.tenantId,
      memberCode: memberCode.toUpperCase(),
      status: 'active',
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        error: { code: 'MEMBER_NOT_FOUND', message: 'Member code does not exist' },
      });
    }

    const result = await validateAndProcessCheckIn({
      tenantId: req.tenantId,
      memberId: member._id,
      method,
      recordedByUserId: req.user.userId,
    });

    return res.status(201).json({
      success: true,
      message: `Welcome, ${result.member.fullName}! Check-in recorded.`,
      data: {
        attendanceId: result.record._id,
        memberCode: result.member.memberCode,
        fullName: result.member.fullName,
        planName: result.membership.planSnapshot.name,
        expiresOn: result.membership.endDate,
        checkInTime: result.record.checkInTime,
      },
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: err.errors } });
    }
    next(err);
  }
};

// 2. Dynamic QR Token Generator (Called by Member App)
exports.generateMemberQrPass = async (req, res, next) => {
  try {
    const { memberId } = req.params;

    const member = await Member.findOne({ _id: memberId, tenantId: req.tenantId, status: 'active' });
    if (!member) {
      return res.status(404).json({ success: false, error: { code: 'MEMBER_NOT_FOUND', message: 'Member not found' } });
    }

    // Pass expires in 60 seconds to prevent screenshots
    const qrPassToken = jwt.sign(
      {
        memberId: member._id,
        tenantId: req.tenantId,
        type: 'attendance_pass',
      },
      process.env.JWT_SECRET,
      { expiresIn: '60s' }
    );

    return res.status(200).json({
      success: true,
      data: {
        qrToken: qrPassToken,
        expiresInSeconds: 60,
      },
    });
  } catch (err) {
    next(err);
  }
};

// 3. Scanner reads dynamic QR token at turnstile/desk
exports.scanDynamicQrPass = async (req, res, next) => {
  try {
    const { qrToken } = qrScanSchema.parse(req.body);

    let decoded;
    try {
      decoded = jwt.verify(qrToken, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({
        success: false,
        error: { code: 'QR_EXPIRED_OR_INVALID', message: 'QR Code expired or invalid. Please refresh pass.' },
      });
    }

    if (decoded.tenantId !== String(req.tenantId) || decoded.type !== 'attendance_pass') {
      return res.status(403).json({
        success: false,
        error: { code: 'INVALID_TENANT_QR', message: 'QR Pass belongs to another facility' },
      });
    }

    const result = await validateAndProcessCheckIn({
      tenantId: req.tenantId,
      memberId: decoded.memberId,
      method: 'qr_dynamic',
      recordedByUserId: req.user.userId,
    });

    return res.status(201).json({
      success: true,
      message: `Verified: ${result.member.fullName}`,
      data: {
        attendanceId: result.record._id,
        fullName: result.member.fullName,
        memberCode: result.member.memberCode,
        planName: result.membership.planSnapshot.name,
        expiresOn: result.membership.endDate,
        checkInTime: result.record.checkInTime,
      },
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: err.errors } });
    }
    next(err);
  }
};

// 4. View Attendance Logs & Real-time Desk Stream
exports.getAttendanceLogs = async (req, res, next) => {
  try {
    const queryData = attendanceHistoryQuerySchema.parse(req.query);
    const page = parseInt(queryData.page);
    const limit = parseInt(queryData.limit);
    const skip = (page - 1) * limit;

    const filter = { tenantId: req.tenantId };

    if (queryData.memberId) {
      filter.memberId = queryData.memberId;
    }

    if (queryData.date) {
      const startOfDay = new Date(`${queryData.date}T00:00:00.000+05:30`);
      const endOfDay = new Date(`${queryData.date}T23:59:59.999+05:30`);
      filter.checkInTime = { $gte: startOfDay,$lte: endOfDay };
    }

    const [logs, total] = await Promise.all([
      Attendance.find(filter).sort({ checkInTime: -1 }).skip(skip).limit(limit).lean(),
      Attendance.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: err.errors } });
    }
    next(err);
  }
};