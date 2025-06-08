const express = require('express');
const crypto = require('crypto');
const { db, cleanupExpiredSessions } = require('../models/database');
const router = express.Router();

// Authentication middleware
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        console.log('No authorization header');
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    if (!token || token.length !== 36) {
        console.log('Invalid token format:', token);
        return res.status(401).json({ error: 'Invalid token format' });
    }

    try {
        // First check if session exists
        db.get('SELECT id, user_id, expires_at FROM sessions WHERE id = ?', [token], (err, session) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }

            if (!session) {
                console.log('Session not found:', token);
                return res.status(401).json({ error: 'Invalid session' });
            }

            // Check if session is expired
            const now = new Date();
            const expiresAt = new Date(session.expires_at);
            if (now > expiresAt) {
                console.log('Session expired:', token);
                return res.status(401).json({ error: 'Session expired' });
            }

            // Extend session by 24 hours
            const newExpiration = new Date();
            newExpiration.setHours(newExpiration.getHours() + 24);
            
            db.run(
                'UPDATE sessions SET expires_at = ? WHERE id = ?',
                [newExpiration, token],
                function(err) {
                    if (err) {
                        console.error('Failed to extend session:', err);
                        return res.status(500).json({ error: 'Failed to extend session' });
                    }
                    
                    console.log('Session extended:', token);
                    req.userId = session.user_id;
                    next();
                }
            );
        });
    } catch (error) {
        console.error('Session validation error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

// Register endpoint
router.post('/register', (req, res) => {
    const { username, email, password, fullName } = req.body;
    
    if (!username || !email || !password || !fullName) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const hashedPassword = password; // In production, use bcrypt

    db.run(
        'INSERT INTO users (username, email, password, full_name) VALUES (?, ?, ?, ?)',
        [username, email, hashedPassword, fullName],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'Username or email already exists' });
                }
                return res.status(500).json({ error: err.message });
            }

            // Get the newly created user
            db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }

                // Create session for the user
                const sessionId = crypto.randomUUID();
                const expiration = new Date();
                expiration.setHours(expiration.getHours() + 24); // 24-hour session

                db.run(
                    'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
                    [sessionId, user.id, expiration],
                    (err) => {
                        if (err) {
                            return res.status(500).json({ error: err.message });
                        }

                        // Return success response with token and user data
                        res.json({
                            success: true,
                            message: 'Registration successful',
                            token: sessionId,
                            user: {
                                id: user.id,
                                username: user.username,
                                email: user.email,
                                fullName: user.full_name,
                                role: user.role
                            }
                        });
                    }
                );
            });
        }
    );
});

// Login endpoint
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (user.password !== password) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const sessionId = crypto.randomUUID();
        db.run(
            'INSERT INTO sessions (id, user_id) VALUES (?, ?)',
            [sessionId, user.id],
            (err) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }

                res.json({
                    success: true,
                    token: sessionId,
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        fullName: user.full_name,
                        role: user.role
                    }
                });
            }
        );
    });
});

// Profile endpoint
router.get('/profile', authenticateToken, (req, res) => {
    // Get the auth header to get the token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    
    // Extend the session
    const newExpiration = new Date();
    newExpiration.setHours(newExpiration.getHours() + 24);
    
    db.run(
        'UPDATE sessions SET expires_at = ? WHERE id = ?',
        [newExpiration, token],
        function(err) {
            if (err) {
                console.error('Failed to extend session:', err);
                return res.status(500).json({ error: 'Failed to extend session' });
            }
            
            // Get user data
            db.get('SELECT * FROM users WHERE id = ?', [req.userId], (err, user) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }

                if (!user) {
                    return res.status(401).json({ error: 'User not found' });
                }

                res.json({
                    success: true,
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        fullName: user.full_name,
                        role: user.role
                    }
                });
            });
        }
    );
});

module.exports = router;
