require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const { startReminderCron } = require('./jobs/reminderJob');

const PORT = process.env.PORT || 5000;

// Connect to MongoDB and start HTTP server
const startServer = async () => {
  try {
    await connectDB();

    // Start automated daily reminder cron job (every day at 10:00 AM)
    if (process.env.NODE_ENV !== 'test') {
      startReminderCron();
    }
    const server = app.listen(PORT, () => {
      console.log(`===============================================`);
      console.log(` UdhaarBook API Server running on port ${PORT}`);
      console.log(` Mode: ${process.env.NODE_ENV || 'development'}`);
      console.log(` Health check: http://localhost:${PORT}/api/health`);
      console.log(`===============================================`);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      console.error('UNHANDLED REJECTION:', err.message);
      server.close(() => process.exit(1));
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      console.error('UNCAUGHT EXCEPTION:', err.message);
      process.exit(1);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully...');
      server.close(() => {
        console.log('Server terminated');
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
  }
};

startServer();

