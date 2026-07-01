const express = require('express');
const router = express.Router();
const { getSessions, createSession, deleteSession } = require('../controllers/sessionController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', getSessions);
router.post('/', createSession);
router.delete('/:id', deleteSession);

module.exports = router;
