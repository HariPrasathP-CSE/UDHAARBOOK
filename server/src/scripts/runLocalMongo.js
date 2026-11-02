const fs = require('fs');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongodInstance = null;

async function startEmbeddedMongo() {
  const dbPath = path.resolve(__dirname, '../../.mongo-data');
  fs.mkdirSync(dbPath, { recursive: true });

  console.log('=====================================================');
  console.log('       STARTING EMBEDDED LOCAL MONGODB SERVER        ');
  console.log('=====================================================');
  console.log(`Persistent Storage: ${dbPath}`);
  console.log('Port: 27017');

  try {
    mongodInstance = await MongoMemoryServer.create({
      instance: {
        port: 27017,
        dbPath,
        storageEngine: 'wiredTiger'
      }
    });

    console.log('\n✓ MongoDB successfully running on: mongodb://127.0.0.1:27017/udhaarbook');
    console.log('Ready to accept connections. Keep this terminal open while working.\n');

    process.on('SIGINT', async () => {
      console.log('\nShutting down MongoDB server...');
      if (mongodInstance) await mongodInstance.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      if (mongodInstance) await mongodInstance.stop();
      process.exit(0);
    });

    return mongodInstance;
  } catch (error) {
    if (error.message.includes('EADDRINUSE') || error.message.includes('already running') || error.message.includes('code 48')) {
      console.log('✓ A MongoDB instance is already running on port 27017. You are good to go!');
      process.exit(0);
    } else {
      console.error('Failed to start embedded MongoDB:', error.message);
      process.exit(1);
    }
  }
}

if (require.main === module) {
  startEmbeddedMongo();
}

module.exports = { startEmbeddedMongo };

