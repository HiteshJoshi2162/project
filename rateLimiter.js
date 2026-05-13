const rateLimit = require('express-rate-limit');

const extractLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,

    standardHeaders: true,
    legacyHeaders: false,

    message: {
        status: 'error',
        message:
            'Too many requests. Please try again later.'
    }
});

module.exports = {
    extractLimiter
};
