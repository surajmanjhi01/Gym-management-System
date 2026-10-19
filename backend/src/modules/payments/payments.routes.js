const express = require('express');
const router = express.Router();
const paymentsController = require('./payments.controller');
const authenticate = require('../../middleware/authenticate');
const resolveTenant = require('../../middleware/resolveTenant');

router.use(authenticate, resolveTenant);

router.post('/charges', paymentsController.createCharge);
router.post('/record', paymentsController.recordPayment);
router.get('/receipts/:receiptId', paymentsController.getReceipt);
router.get('/ledger/:memberId', paymentsController.getMemberLedger);
// POST /api/v1/payments/charges/:chargeId/mark-paid
router.post('/charges/:chargeId/mark-paid', paymentsController.quickSettleCharge);

module.exports = router;