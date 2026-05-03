const express = require('express');
const router = express.Router();
const extractController = require('./extract.controller');
const { extractLimiter } = require('./rateLimiter');

router.post('/extract', extractLimiter, extractController.extractMedia);

module.exports = router;
