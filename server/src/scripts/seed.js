require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Shop = require('../models/Shop');
const Account = require('../models/Account');
const LedgerEntry = require('../models/LedgerEntry');
const Dispute = require('../models/Dispute');
const Notification = require('../models/Notification');
const Reminder = require('../models/Reminder');

async function seedDatabase(customUri) {
  console.log('=====================================================');
  console.log('     UDHAARBOOK DATABASE SEED SCRIPT (PHASE 7)      ');
  console.log('=====================================================');

  const uri = customUri || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/udhaarbook';
  let embeddedMongo = null;

  try {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 2500 });
      console.log(`Connected to MongoDB: ${uri}`);
    } catch (connErr) {
      const isRefused =
        connErr.name === 'MongooseServerSelectionError' ||
        connErr.message.includes('ECONNREFUSED');

      if (isRefused && uri.includes('127.0.0.1:27017')) {
        console.log('⚠️ Local MongoDB server not running on port 27017.');
        console.log('⚡ Launching embedded persistent MongoDB on 127.0.0.1:27017...');
        const path = require('path');
        const fs = require('fs');
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const dbPath = path.resolve(__dirname, '../../.mongo-data');
        fs.mkdirSync(dbPath, { recursive: true });

        try {
          embeddedMongo = await MongoMemoryServer.create({
            instance: {
              port: 27017,
              dbPath,
              storageEngine: 'wiredTiger'
            }
          });
        } catch (e) {
          // If already running
        }
        await mongoose.connect('mongodb://127.0.0.1:27017/udhaarbook');
        console.log('✓ Connected to embedded MongoDB successfully!');
      } else {
        throw connErr;
      }
    }

    console.log('\n[1/6] Cleaning existing database collections...');
    await Promise.all([
      User.deleteMany({}),
      Shop.deleteMany({}),
      Account.deleteMany({}),
      LedgerEntry.deleteMany({}),
      Dispute.deleteMany({}),
      Notification.deleteMany({}),
      Reminder.deleteMany({})
    ]);
    console.log('✓ Collections wiped clean.');

    // 1. Create Admin
    console.log('\n[2/6] Creating Platform Admin...');
    const adminPasswordHash = await bcrypt.hash('Admin@123', 10);
    const admin = await User.create({
      name: 'System Administrator',
      email: 'admin@udhaarbook.in',
      phone: '9999900000',
      passwordHash: adminPasswordHash,
      role: 'admin',
      isActive: true
    });
    console.log(`✓ Admin created: admin@udhaarbook.in (Password: Admin@123)`);

    // 2. Create 2 Shopkeepers & Shops
    console.log('\n[3/6] Creating 2 Shopkeepers & Shops...');
    const shopkeeperPasswordHash = await bcrypt.hash('Shop@123', 10);

    const sk1 = await User.create({
      name: 'Ramesh Gupta',
      email: 'ramesh.gupta@kirana.in',
      phone: '9811100001',
      passwordHash: shopkeeperPasswordHash,
      role: 'shopkeeper',
      isActive: true
    });

    const shop1 = await Shop.create({
      owner: sk1._id,
      name: 'Gupta Kirana & General Store',
      address: 'Plot 14, Main Bazaar, Chandni Chowk, Old Delhi',
      phone: '9811100001',
      active: true,
      reminderSettings: {
        enabled: true,
        frequencyDays: 5,
        minOverdueDays: 7,
        messageTemplate:
          'Dear {customerName}, this is a gentle reminder that your outstanding balance of ₹{amount} at {shopName} is overdue. Kindly clear your dues at your earliest convenience.'
      }
    });

    const sk2 = await User.create({
      name: 'Suresh Verma',
      email: 'suresh.verma@kirana.in',
      phone: '9811100002',
      passwordHash: shopkeeperPasswordHash,
      role: 'shopkeeper',
      isActive: true
    });

    const shop2 = await Shop.create({
      owner: sk2._id,
      name: 'Verma Provision & Departmental Store',
      address: 'Shop 7, Commercial Complex, Sector 18, Noida',
      phone: '9811100002',
      active: true,
      reminderSettings: {
        enabled: true,
        frequencyDays: 7,
        minOverdueDays: 8,
        messageTemplate:
          'Dear {customerName}, kindly note that your ledger balance of ₹{amount} at {shopName} is pending for settlement.'
      }
    });
    console.log(`✓ Shop 1: "${shop1.name}" (ramesh.gupta@kirana.in)`);
    console.log(`✓ Shop 2: "${shop2.name}" (suresh.verma@kirana.in)`);

    // 3. Create 10 Customers
    console.log('\n[4/6] Creating 10 Customers...');
    const customerPasswordHash = await bcrypt.hash('Customer@123', 10);
    const customerData = [
      { name: 'Anand Kumar', email: 'anand.kumar@gmail.com', phone: '9822200001' },
      { name: 'Priya Sharma', email: 'priya.sharma@gmail.com', phone: '9822200002' },
      { name: 'Rahul Mehta', email: 'rahul.mehta@gmail.com', phone: '9822200003' },
      { name: 'Sunita Patel', email: 'sunita.patel@gmail.com', phone: '9822200004' },
      { name: 'Amit Singh', email: 'amit.singh@gmail.com', phone: '9822200005' },
      { name: 'Neha Gupta', email: 'neha.gupta@gmail.com', phone: '9822200006' },
      { name: 'Vikram Joshi', email: 'vikram.joshi@gmail.com', phone: '9822200007' },
      { name: 'Pooja Reddy', email: 'pooja.reddy@gmail.com', phone: '9822200008' },
      { name: 'Rohit Malhotra', email: 'rohit.malhotra@gmail.com', phone: '9822200009' },
      { name: 'Kavita Nair', email: 'kavita.nair@gmail.com', phone: '9822200010' }
    ];

    const customers = [];
    for (const cd of customerData) {
      const c = await User.create({
        ...cd,
        passwordHash: customerPasswordHash,
        role: 'customer',
        isActive: true
      });
      customers.push(c);
    }
    console.log(`✓ Created 10 customers (Password: Customer@123)`);

    // 4. Create Linked Customer Accounts
    console.log('\n[5/6] Linking customer accounts to shops...');
    const accounts = [];

    // Link customers 0..6 to Shop 1
    for (let i = 0; i < 7; i++) {
      const acc = await Account.create({
        shop: shop1._id,
        customer: customers[i]._id,
        creditLimit: (5000 + i * 2000) * 100, // ₹5,000 to ₹17,000 in paise
        active: true
      });
      accounts.push(acc);
    }

    // Link customers 4..9 to Shop 2 (some overlap for multi-shop customer experience)
    for (let i = 4; i < 10; i++) {
      const acc = await Account.create({
        shop: shop2._id,
        customer: customers[i]._id,
        creditLimit: (6000 + (i - 4) * 2500) * 100, // ₹6,000 to ₹18,500
        active: true
      });
      accounts.push(acc);
    }
    console.log(`✓ Created ${accounts.length} customer accounts across 2 shops.`);

    // 5. Generate 100 Ledger Entries across all statuses & age buckets
    console.log('\n[6/6] Generating 100 realistic ledger entries across statuses and age buckets...');
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    // We will generate exactly 100 entries:
    // Status distribution: ~45 acknowledged, ~30 pending, ~15 disputed/resolved, ~10 reversals
    // Age distribution: ~35 in 0–7 days, ~35 in 8–30 days, ~30 in 31–120 days
    const notesCredit = [
      'Daily grocery supplies, milk & curd',
      'Wheat flour 10kg, Basmati rice 5kg',
      'Cooking oil & refined sugar',
      'Tea, spices, lentils and dry fruits',
      'Cleaning supplies, soaps & detergents',
      'Snacks, biscuits, chocolates & cold drinks',
      'Fresh paneer, butter and cheese slices',
      'Monthly provision bundle package'
    ];

    const notesPayment = [
      'Cash payment at billing counter',
      'UPI transfer via Google Pay',
      'Partial cash instalment paid',
      'Settlement via Paytm QR code',
      'Weekly payment settlement',
      'Cheque clearance credited'
    ];

    let entryCount = 0;
    const createdEntries = [];

    // Define target distribution schedule (total = 100)
    for (let i = 1; i <= 100; i++) {
      const account = accounts[i % accounts.length];
      const shopId = account.shop.toString() === shop1._id.toString() ? shop1 : shop2;
      const createdBy = shopId.owner;

      // Age allocation:
      // 1..35: 0 to 7 days
      // 36..70: 8 to 30 days
      // 71..100: 31 to 120 days
      let daysAgo;
      if (i <= 35) {
        daysAgo = (i % 7) + 0.5; // 0–7 days
      } else if (i <= 70) {
        daysAgo = 8 + (i % 22); // 8–30 days
      } else {
        daysAgo = 31 + ((i * 3) % 85); // 31–115 days
      }
      const entryDate = new Date(now - daysAgo * DAY_MS);

      // Type allocation: ~70 credits, ~30 payments
      const isCredit = i % 3 !== 0; // 1,2: credit, 3: payment
      const type = isCredit ? 'credit' : 'payment';

      // Amount: ₹120 to ₹2,800
      const amountPaise = (120 + ((i * 37) % 2680)) * 100;
      const note = isCredit
        ? notesCredit[i % notesCredit.length]
        : notesPayment[i % notesPayment.length];

      // Status allocation:
      // i % 10 === 0 -> disputed
      // i % 10 === 1 && i > 50 -> resolved
      // i % 4 === 0 -> pending
      // else -> acknowledged
      let status = 'acknowledged';
      if (i % 10 === 0) {
        status = 'disputed';
      } else if (i % 10 === 1 && i > 50) {
        status = 'resolved';
      } else if (i % 4 === 0) {
        status = 'pending';
      }

      const entry = await LedgerEntry.create({
        account: account._id,
        type,
        amountPaise,
        note,
        entryDate,
        status,
        createdBy,
        isReversed: false,
        reversalOf: null
      });

      createdEntries.push(entry);
      entryCount++;

      // Create Disputes for disputed/resolved entries
      if (status === 'disputed') {
        const dispute = await Dispute.create({
          entry: entry._id,
          account: account._id,
          raisedBy: account.customer,
          reason: 'Item billed was not delivered / price discrepancy',
          status: i % 20 === 0 ? 'escalated' : 'open',
          history: [
            {
              status: 'open',
              action: 'dispute_opened',
              note: 'Customer disputed the amount or items listed',
              updatedBy: account.customer,
              timestamp: entryDate
            }
          ]
        });

        if (dispute.status === 'escalated') {
          dispute.history.push({
            status: 'escalated',
            action: 'dispute_escalated',
            note: 'No resolution reached with shopkeeper, escalated to platform admin',
            updatedBy: account.customer,
            timestamp: new Date(entryDate.getTime() + 2 * DAY_MS)
          });
          await dispute.save();
        }
      } else if (status === 'resolved' && i % 10 === 1) {
        await Dispute.create({
          entry: entry._id,
          account: account._id,
          raisedBy: account.customer,
          reason: 'Billed twice for the same purchase',
          status: 'resolved',
          resolution: 'accepted_by_shopkeeper',
          resolvedBy: createdBy,
          history: [
            {
              status: 'open',
              action: 'dispute_opened',
              note: 'Dispute opened by customer',
              updatedBy: account.customer,
              timestamp: entryDate
            },
            {
              status: 'resolved',
              action: 'dispute_resolved',
              note: 'Shopkeeper verified transaction and resolved dispute',
              updatedBy: createdBy,
              timestamp: new Date(entryDate.getTime() + DAY_MS)
            }
          ]
        });
      }
    }

    // Now create 6 reversal pairs to demonstrate append-only reversal corrections (bringing total to 106 entries)
    console.log('✓ Creating reversal entries to demonstrate append-only corrections...');
    for (let r = 0; r < 6; r++) {
      const orig = createdEntries[r * 12 + 5];
      const reverseType = orig.type === 'credit' ? 'payment' : 'credit';
      orig.isReversed = true;
      await orig.save();

      await LedgerEntry.create({
        account: orig.account,
        type: reverseType,
        amountPaise: orig.amountPaise,
        note: `Correction: Reversal of ${orig.type} entry ${orig._id}`,
        entryDate: new Date(orig.entryDate.getTime() + 12 * 60 * 60 * 1000),
        status: 'resolved',
        createdBy: orig.createdBy,
        reversalOf: orig._id,
        isReversed: false
      });
      entryCount++;
    }

    // Create a couple of Reminder records
    console.log('✓ Logging sample payment reminders...');
    await Reminder.create({
      shop: shop1._id,
      account: accounts[0]._id,
      customer: accounts[0].customer,
      amountPaise: 420000,
      type: 'manual',
      channel: 'both',
      status: 'sent',
      message: 'Dear Anand Kumar, this is a reminder for your pending balance of ₹4,200.00 at Gupta Kirana.',
      emailSent: true,
      inAppSent: true,
      sentBy: sk1._id,
      sentAt: new Date(now - 3 * DAY_MS)
    });

    await Reminder.create({
      shop: shop2._id,
      account: accounts[7]._id,
      customer: accounts[7].customer,
      amountPaise: 680000,
      type: 'automated',
      channel: 'both',
      status: 'sent',
      message: 'Dear Amit Singh, your overdue balance of ₹6,800.00 at Verma Provision Store is due.',
      emailSent: true,
      inAppSent: true,
      sentBy: null,
      sentAt: new Date(now - 1 * DAY_MS)
    });

    console.log(`\n=====================================================`);
    console.log(` SEED COMPLETED SUCCESSFULLY!`);
    console.log(` - 1 Admin: admin@udhaarbook.in (Admin@123)`);
    console.log(` - 2 Shopkeepers: ramesh.gupta@kirana.in, suresh.verma@kirana.in (Shop@123)`);
    console.log(` - 10 Customers: anand.kumar@gmail.com, etc. (Customer@123)`);
    console.log(` - ${accounts.length} Linked Accounts`);
    console.log(` - ${entryCount} Total Ledger Entries created`);
    console.log(` - Spread across 0–7d, 8–30d, 30+d and pending, acknowledged, disputed, resolved`);
    console.log(`=====================================================\n`);

    await mongoose.disconnect();
    if (embeddedMongo) {
      await embeddedMongo.stop();
    }
    if (require.main === module) {
      process.exit(0);
    }
  } catch (error) {
    console.error('Seed script error:', error);
    await mongoose.disconnect();
    if (embeddedMongo) {
      await embeddedMongo.stop();
    }
    if (require.main === module) {
      process.exit(1);
    }
    throw error;
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
