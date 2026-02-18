const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middlewares/auth');

router.get('/mine', authenticate, notificationController.listMine);
router.patch('/read-all', authenticate, notificationController.markAllRead);
router.patch('/:id/read', authenticate, notificationController.markRead);
router.post('/events/pricing', authenticate, notificationController.createPricingEvent);

module.exports = router;
