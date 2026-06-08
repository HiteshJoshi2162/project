require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const extractRoutes = require('./routes/extract.routes');
const { errorHandler } = require('./middleware/error.middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Security
app.use(
    helmet({
        crossOriginResourcePolicy: false
    })
);

// CORS
app.use(
    cors({
        origin: '*',
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type']
    })
);

// Body Parser
app.use(
    express.json({
        limit: '10mb'
    })
);

// Logger
app.use(morgan('dev'));

// Request Logger
app.use((req, res, next) => {

    console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} IP:${req.ip}`
    );

    next();
});

// Root Route
app.get('/', (req, res) => {

    res.status(200).json({
        status: 'success',
        message: 'Instagram Media Extractor API Running 🚀'
    });
});

// Health Route
app.get('/health', (req, res) => {

    res.status(200).json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// API Routes
app.use('/api', extractRoutes);

// 404 Handler
app.use((req, res) => {

    res.status(404).json({
        status: 'error',
        message: 'Route not found'
    });
});

// Global Error Handler
app.use(errorHandler);

// Start Server
app.listen(PORT, '0.0.0.0', () => {

    console.log('===================================');
    console.log(`🚀 Server Running On Port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📡 Health URL: /health`);
    console.log('===================================');

});

// Prevent Crashes
process.on('unhandledRejection', (err) => {

    console.error('❌ Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {

    console.error('❌ Uncaught Exception:', err);
});
