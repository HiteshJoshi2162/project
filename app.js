require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const extractRoutes = require('./routes/extract.routes');
const { errorHandler } = require('./middleware/error.middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Request Logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} from ${req.ip}`);
    next();
});

// Routes
app.get('/', (req, res) => res.send('Story Reels Saver API is running!'));
app.use('/api', extractRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Error Handling
app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`--------------------------------------------------`);
    console.log(`🚀 SERVER RUNNING AT: http://192.168.31.206:${PORT}`);
    console.log(`✅ Listening on all interfaces (0.0.0.0)`);
    console.log(`📱 Connect your Android phone to: http://192.168.31.206:${PORT}/health`);
    console.log(`--------------------------------------------------`);
});
