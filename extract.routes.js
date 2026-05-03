const express = require('express');
const router = express.Router();
const extractController = require('./extract.controller');
const rateLimiter = require('./rateLimiter');

router.post('/extract', rateLimiter, extractController.handleExtraction);

module.exports = router;
