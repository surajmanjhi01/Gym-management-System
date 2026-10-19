const express = require('express');
const router = express.Router();
const membershipsController = require('./memberships.controller');
const authenticate = require('../../middleware/authenticate');
const resolveTenant = require('../../middleware/resolveTenant');

router.use(authenticate, resolveTenant);

// Plan templates
router.post('/plans', membershipsController.createPlan);
router.get('/plans', membershipsController.getPlans);

// Member assignments & lifecycle
router.post('/assign', membershipsController.assignPlan);
router.post('/:id/freeze', membershipsController.freezeMembership);
router.post('/:id/unfreeze', membershipsController.unfreezeMembership);

module.exports = router;