const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

let embeddedMongoInstance = null;

const connectDB = async () => {
  // Reuse existing connection in serverless environments (Vercel)
  if (mongoose.connection && mongoose.connection.readyState >= 1) {
    return mongoose.connection;
  }

  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/udhaarbook';

  try {
    const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 2500 });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    const isConnRefused =
      error.name === 'MongooseServerSelectionError' ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('connect ECONNREFUSED');

    // If local default MongoDB on 127.0.0.1:27017 is refused, auto-start embedded Mongo for seamless local dev!
    if (isConnRefused && uri.includes('127.0.0.1:27017')) {
      console.log('⚠️ Local MongoDB server not running on port 27017.');
      console.log('⚡ Launching embedded persistent MongoDB on 127.0.0.1:27017...');

      try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const dbPath = path.resolve(__dirname, '../../.mongo-data');
        fs.mkdirSync(dbPath, { recursive: true });

        embeddedMongoInstance = await MongoMemoryServer.create({
          instance: {
            port: 27017,
            dbPath,
            storageEngine: 'wiredTiger'
          }
        });

        const conn = await mongoose.connect('mongodb://127.0.0.1:27017/udhaarbook');
        console.log(`✓ Embedded MongoDB started: mongodb://127.0.0.1:27017/udhaarbook`);
        return conn;
      } catch (embeddedErr) {
        if (
          embeddedErr.message.includes('EADDRINUSE') ||
          embeddedErr.message.includes('already running') ||
          embeddedErr.message.includes('code 48')
        ) {
          const conn = await mongoose.connect('mongodb://127.0.0.1:27017/udhaarbook');
          console.log(`✓ Connected to existing MongoDB on port 27017`);
          return conn;
        }
        console.error('Failed to auto-launch embedded MongoDB:', embeddedErr.message);
      }
    }

    console.error(`MongoDB Connection Error: ${error.message}`);
    throw error;
  }
};

module.exports = connectDB;
