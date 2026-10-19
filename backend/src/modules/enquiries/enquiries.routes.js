const express = require('express');
const router = express.Router();
const enquiriesController = require('./enquires.controller');
const authenticate = require('../../middleware/authenticate');
const resolveTenant = require('../../middleware/resolveTenant');

router.use(authenticate, resolveTenant);

router.post('/', enquiriesController.createEnquiry);
router.get('/', enquiriesController.getEnquiries);
router.post('/:id/follow-up', enquiriesController.logFollowUp);
router.post('/:id/convert', enquiriesController.convertToMember);

module.exports = router;