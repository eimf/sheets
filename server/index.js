const express = require('express');
const cors = require('cors');
const config = require('./config/config');
const { initializeDatabase } = require('./models/database');
const authRoutes = require('./routes/auth');
const servicesRoutes = require('./routes/services');

const app = express();
const port = config.port;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize database
initializeDatabase();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/services', servicesRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    // Internal server error occurred
    res.status(500).json({
        success: false,
        error: 'Internal Server Error'
    });
});

// Start server
app.listen(port, () => {
    // Server started successfully
});
