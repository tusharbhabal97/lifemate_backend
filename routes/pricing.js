const express = require('express');
const router = express.Router();
const pricingController = require('../controllers/pricingController');
const { optionalAuth } = require('../middlewares/auth');

router.get('/plans', optionalAuth, pricingController.listPlans);

module.exports = router;
