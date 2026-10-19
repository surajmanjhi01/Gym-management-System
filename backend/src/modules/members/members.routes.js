const express = require('express');
const router = express.Router();
const membersController = require('./members.controller');
const authenticate = require('../../middleware/authenticate');
const resolveTenant = require('../../middleware/resolveTenant');

// Lock every member route behind Authentication and Tenant Resolution
router.use(authenticate, resolveTenant);

router.post('/', membersController.createMember);
router.get('/', membersController.getMembers);
router.get('/:id', membersController.getMemberById);
router.patch('/:id', membersController.updateMember);
router.post('/:id/archive', membersController.archiveMember);

module.exports = router;