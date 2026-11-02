const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed: No token provided'
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed: Token is empty'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'udhaarbook_super_secret_jwt_key_2026_secure');
    req.user = decoded; // Contains id, role, email
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed: Token expired'
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Authentication failed: Invalid token'
    });
  }
};

module.exports = auth;

