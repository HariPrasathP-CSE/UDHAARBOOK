const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const User = require('../src/models/User');
const Shop = require('../src/models/Shop');
const Account = require('../src/models/Account');
const LedgerEntry = require('../src/models/LedgerEntry');
const Dispute = require('../src/models/Dispute');
const Reminder = require('../src/models/Reminder');
const seedDatabase = require('../src/scripts/seed');

async function testSeed() {
  console.log('--- Verifying UdhaarBook Database Seed Script ---');
  let mongoServer;

  try {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongoServer.getUri();

    // Run seed function
    await seedDatabase(mongoServer.getUri());

    // Reconnect to verify
    await mongoose.connect(process.env.MONGO_URI);

    const [adminCount, shopCount, customerCount, accountCount, entryCount, disputeCount, reminderCount] =
      await Promise.all([
        User.countDocuments({ role: 'admin' }),
        Shop.countDocuments(),
        User.countDocuments({ role: 'customer' }),
        Account.countDocuments(),
        LedgerEntry.countDocuments(),
        Dispute.countDocuments(),
        Reminder.countDocuments()
      ]);

    console.log(`\nSeed Verification Results:`);
    console.log(`- Admins: ${adminCount} (expected: 1)`);
    console.log(`- Shops: ${shopCount} (expected: 2)`);
    console.log(`- Customers: ${customerCount} (expected: 10)`);
    console.log(`- Accounts: ${accountCount} (expected: >= 10)`);
    console.log(`- Ledger Entries: ${entryCount} (expected: >= 100)`);
    console.log(`- Disputes: ${disputeCount} (expected: > 0)`);
    console.log(`- Reminders: ${reminderCount} (expected: > 0)`);

    if (adminCount !== 1) throw new Error(`Expected 1 admin, got ${adminCount}`);
    if (shopCount !== 2) throw new Error(`Expected 2 shops, got ${shopCount}`);
    if (customerCount !== 10) throw new Error(`Expected 10 customers, got ${customerCount}`);
    if (entryCount < 100) throw new Error(`Expected >= 100 entries, got ${entryCount}`);

    // Check entry status variety
    const statuses = await LedgerEntry.distinct('status');
    console.log(`- Statuses present: ${statuses.join(', ')}`);
    ['pending', 'acknowledged', 'disputed', 'resolved'].forEach((st) => {
      if (!statuses.includes(st)) throw new Error(`Missing status in seed: ${st}`);
    });

    console.log('\n======================================================');
    console.log(' SEED SCRIPT VERIFICATION PASSED (100%)');
    console.log('======================================================\n');

    await mongoose.disconnect();
    await mongoServer.stop();
    process.exit(0);
  } catch (err) {
    console.error('Seed test error:', err.message);
    if (mongoServer) await mongoServer.stop();
    process.exit(1);
  }
}

testSeed();
