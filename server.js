const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// In-memory storage (in production, use a real database)
let users = {};
let subscriptions = {};

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Get user subscription status
app.get('/api/user/:userId/subscription', (req, res) => {
    const { userId } = req.params;
    const subscription = subscriptions[userId];
    
    if (!subscription) {
        return res.json({
            active: false,
            expiresAt: null,
            message: 'No subscription found'
        });
    }
    
    const isActive = new Date(subscription.expiresAt) > new Date();
    
    res.json({
        active: isActive,
        expiresAt: subscription.expiresAt,
        plan: subscription.plan || 'basic'
    });
});

// Create or update subscription
app.post('/api/user/:userId/subscription', (req, res) => {
    const { userId } = req.params;
    const { plan = 'basic', durationDays = 30 } = req.body;
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);
    
    subscriptions[userId] = {
        plan,
        expiresAt: expiresAt.toISOString(),
        createdAt: new Date().toISOString()
    };
    
    res.json({
        success: true,
        subscription: subscriptions[userId]
    });
});

// Get user progress
app.get('/api/user/:userId/progress', (req, res) => {
    const { userId } = req.params;
    // In a real app, this would come from a database
    res.json({
        completedDays: 0,
        currentStreak: 0,
        totalExercises: 0
    });
});

// Save user progress
app.post('/api/user/:userId/progress', (req, res) => {
    const { userId } = req.params;
    const { date, completed } = req.body;
    
    // In a real app, save to database
    console.log(`User ${userId} completed exercise on ${date}: ${completed}`);
    
    res.json({ success: true });
});

// Get user profile
app.get('/api/user/:userId/profile', (req, res) => {
    const { userId } = req.params;
    const profile = users[userId] || {};
    
    res.json(profile);
});

// Update user profile
app.post('/api/user/:userId/profile', (req, res) => {
    const { userId } = req.params;
    const profileData = req.body;
    
    users[userId] = {
        ...users[userId],
        ...profileData,
        updatedAt: new Date().toISOString()
    };
    
    res.json({
        success: true,
        profile: users[userId]
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} to view the app`);
});

module.exports = app;
