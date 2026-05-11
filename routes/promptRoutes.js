const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { newsDepartmentOnly, newsManagerOrAdmin } = require('../middleware/newsDepartment');
const { getAllPrompts, getPromptByStage, updatePrompt, resetPrompt } = require('../controllers/promptController');

router.get('/', protect, newsDepartmentOnly, getAllPrompts);
router.get('/:stage', protect, newsDepartmentOnly, getPromptByStage);
router.put('/:stage', protect, newsDepartmentOnly, updatePrompt);
router.post('/reset', protect, newsDepartmentOnly, resetPrompt);

module.exports = router;
