const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token middleware
const authenticateToken = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    
    if (!token) {
      return res.redirect('/login');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      res.clearCookie('token');
      return res.redirect('/login');
    }

    req.user = user;
    next();
  } catch (error) {
    res.clearCookie('token');
    return res.redirect('/login');
  }
};

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).render('error', {
      error: 'Access denied. Admin privileges required.',
      user: req.user
    });
  }
};

// Check if user is logged in
const isLoggedIn = (req, res, next) => {
  if (req.cookies.token) {
    return res.redirect('/');
  }
  next();
};

module.exports = {
  authenticateToken,
  isAdmin,
  isLoggedIn
}; 