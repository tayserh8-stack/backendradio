const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { newsDepartmentOnly } = require('../middleware/newsDepartment');
const { processPipeline, runSingleStage, checkAIConfig } = require('../controllers/editorialPipelineController');

router.post('/process', protect, newsDepartmentOnly, processPipeline);
router.post('/stage', protect, newsDepartmentOnly, runSingleStage);
router.get('/ai-config', protect, newsDepartmentOnly, checkAIConfig);

module.exports = router;
