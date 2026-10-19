const express = require('express');
const router = express.Router();
const attendanceController = require('./attendance.controller');
const authenticate = require('../../middleware/authenticate');
const resolveTenant = require('../../middleware/resolveTenant');

router.use(authenticate, resolveTenant);

// Front-desk/manual code entry
router.post('/desk-checkin', attendanceController.deskCheckIn);

// Member generating dynamic rolling pass
router.get('/member-pass/:memberId', attendanceController.generateMemberQrPass);

// Scanner verifying dynamic QR token
router.post('/scan-pass', attendanceController.scanDynamicQrPass);

// Reporting and logs feed
router.get('/logs', attendanceController.getAttendanceLogs);

module.exports = router;