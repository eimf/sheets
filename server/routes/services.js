const express = require('express');
const { db } = require('../models/database');
const router = express.Router();

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    db.get('SELECT user_id FROM sessions WHERE id = ?', [token], (err, session) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (!session) {
            return res.status(401).json({ error: 'Invalid session' });
        }

        req.userId = session.user_id;
        next();
    });
};

// Get all services
router.get('/', authenticateToken, (req, res) => {
    db.all(
        'SELECT * FROM services WHERE user_id = ? ORDER BY created_at DESC',
        [req.userId],
        (err, services) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            res.json({
                success: true,
                services: services.map(service => ({
                    ...service,
                    cycle_start_date: service.cycle_start_date,
                    cycle_end_date: service.cycle_end_date,
                    service_date: service.service_date
                }))
            });
        }
    );
});

// Get services by cycle
router.get('/cycle', authenticateToken, (req, res) => {
    const { cycleStart, cycleEnd } = req.query;
    
    if (!cycleStart || !cycleEnd) {
        return res.status(400).json({ error: 'Cycle dates are required' });
    }

    db.all(
        'SELECT * FROM services WHERE user_id = ? AND cycle_start_date <= ? AND cycle_end_date >= ? ORDER BY created_at DESC',
        [req.userId, cycleEnd, cycleStart],
        (err, services) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            res.json({
                success: true,
                services: services.map(service => ({
                    ...service,
                    cycle_start_date: service.cycle_start_date,
                    cycle_end_date: service.cycle_end_date,
                    service_date: service.service_date
                }))
            });
        }
    );
});

// Create service
router.post('/', authenticateToken, (req, res) => {
    const { clientName, serviceType, price, commission, cycleStartDate, cycleEndDate, serviceDate, notes } = req.body;
    
    if (!clientName || !serviceType || !price || !cycleStartDate || !cycleEndDate) {
        return res.status(400).json({ error: 'Required fields are missing' });
    }

    db.run(
        'INSERT INTO services (user_id, client_name, service_type, price, commission, cycle_start_date, cycle_end_date, service_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            req.userId,
            clientName,
            serviceType,
            price,
            commission || null,
            cycleStartDate,
            cycleEndDate,
            serviceDate || null,
            notes || null
        ],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            res.json({
                success: true,
                message: 'Service created successfully',
                serviceId: this.lastID
            });
        }
    );
});

// Update service
router.put('/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { clientName, serviceType, price, commission, cycleStartDate, cycleEndDate, serviceDate, notes } = req.body;

    if (!id) {
        return res.status(400).json({ error: 'Service ID is required' });
    }

    db.get('SELECT * FROM services WHERE id = ? AND user_id = ?', [id, req.userId], (err, service) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (!service) {
            return res.status(404).json({ error: 'Service not found' });
        }

        db.run(
            'UPDATE services SET client_name = ?, service_type = ?, price = ?, commission = ?, cycle_start_date = ?, cycle_end_date = ?, service_date = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [
                clientName || service.client_name,
                serviceType || service.service_type,
                price || service.price,
                commission || service.commission,
                cycleStartDate || service.cycle_start_date,
                cycleEndDate || service.cycle_end_date,
                serviceDate || service.service_date,
                notes || service.notes,
                id
            ],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }

                res.json({
                    success: true,
                    message: 'Service updated successfully'
                });
            }
        );
    });
});

// Delete service
router.delete('/:id', authenticateToken, (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ error: 'Service ID is required' });
    }

    db.run(
        'DELETE FROM services WHERE id = ? AND user_id = ?',
        [id, req.userId],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Service not found' });
            }

            res.json({
                success: true,
                message: 'Service deleted successfully'
            });
        }
    );
});

module.exports = router;
