require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const extractRoutes = require('./extract.routes');
const { errorHandler } = require('./error.middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Security
app.use(helmet());

// CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST']
}));

// Body Parser
app.use(express.json({
    limit: '10mb'
}));

// Logger
app.use(morgan('dev'));

// Request Logger
app.use((req, res, next) => {
    console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} IP:${req.ip}`
    );
    next();
});

// Root
app.get('/', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'Instagram Media Extractor API Running'
    });
});

// Health
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Routes
app.use('/api', extractRoutes);

// 404
app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        message: 'Route not found'
    });
});

// Error Handler
app.use(errorHandler);

// Start Server
app.listen(PORT, '0.0.0.0', () => {
    console.log('===================================');
    console.log(`🚀 Server Running On Port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('===================================');
});
