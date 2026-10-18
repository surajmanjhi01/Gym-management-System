const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');

router.post('/register-gym', authController.registerGymAndOwner);

module.exports = router;