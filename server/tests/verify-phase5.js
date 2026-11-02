const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const LedgerEntry = require('../src/models/LedgerEntry');

let mongoServer;

async function runPhase5Tests() {
  console.log('--- Starting UdhaarBook Phase 5 Ageing, Filters & Dashboard Verification ---');

  try {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log('✓ In-memory MongoDB connected successfully');

    // 1. Setup Users
    console.log('\n[1] Seeding Shopkeeper and 3 Customers:');
    const resShopkeeper = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Balaji Traders',
        email: 'balaji@traders.in',
        phone: '9500000001',
        password: 'password123',
        role: 'shopkeeper'
      });
    const shopkeeperToken = resShopkeeper.body.token;

    const resAlice = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Alice Johnson',
        email: 'alice@customer.in',
        phone: '9500000002',
        password: 'password123',
        role: 'customer'
      });
    const aliceToken = resAlice.body.token;

    const resBob = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Bob Miller',
        email: 'bob@customer.in',
        phone: '9500000003',
        password: 'password123',
        role: 'customer'
      });

    const resCharlie = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Charlie Davis',
        email: 'charlie@customer.in',
        phone: '9500000004',
        password: 'password123',
        role: 'customer'
      });

    // Create Shop
    await request(app)
      .post('/api/shops')
      .set('Authorization', `Bearer ${shopkeeperToken}`)
      .send({ name: 'Balaji Kirana & Provision Store', phone: '9500000001' });

    // Link Accounts
    const resAccAlice = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${shopkeeperToken}`)
      .send({ phone: '9500000002', creditLimit: 100000 });
    const aliceAccountId = resAccAlice.body.account._id;

    const resAccBob = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${shopkeeperToken}`)
      .send({ phone: '9500000003', creditLimit: 150000 });
    const bobAccountId = resAccBob.body.account._id;

    const resAccCharlie = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${shopkeeperToken}`)
      .send({ phone: '9500000004', creditLimit: 50000 });
    const charlieAccountId = resAccCharlie.body.account._id;

    console.log('✓ Shopkeeper and 3 accounts linked successfully');

    // 2. Seed historical ledger entries for FIFO ageing verification
    console.log('\n[2] Seeding dated ledger transactions:');
    const now = new Date();
    const daysAgo = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Alice transactions:
    // - 45 days ago: Credit ₹500 (50,000 paise)
    // - 20 days ago: Credit ₹300 (30,000 paise)
    // - 3 days ago: Credit ₹200 (20,000 paise)
    // - 2 days ago: Payment ₹600 (60,000 paise)
    const aliceEntries = [
      { account: aliceAccountId, type: 'credit', amountPaise: 50000, note: 'Rice bag', entryDate: daysAgo(45), createdBy: resShopkeeper.body.user.id },
      { account: aliceAccountId, type: 'credit', amountPaise: 30000, note: 'Cooking Oil', entryDate: daysAgo(20), createdBy: resShopkeeper.body.user.id },
      { account: aliceAccountId, type: 'credit', amountPaise: 20000, note: 'Spices', entryDate: daysAgo(3), createdBy: resShopkeeper.body.user.id },
      { account: aliceAccountId, type: 'payment', amountPaise: 60000, note: 'UPI Payment', entryDate: daysAgo(2), createdBy: resShopkeeper.body.user.id }
    ];
    await LedgerEntry.insertMany(aliceEntries);

    // Bob transactions:
    // - 35 days ago: Credit ₹800 (80,000 paise), no payments
    const bobEntries = [
      { account: bobAccountId, type: 'credit', amountPaise: 80000, note: 'Wholesale grains', entryDate: daysAgo(35), createdBy: resShopkeeper.body.user.id }
    ];
    await LedgerEntry.insertMany(bobEntries);

    // Charlie transactions:
    // - 2 days ago: Credit ₹150 (15,000 paise), no payments
    const charlieEntries = [
      { account: charlieAccountId, type: 'credit', amountPaise: 15000, note: 'Dairy items', entryDate: daysAgo(2), createdBy: resShopkeeper.body.user.id }
    ];
    await LedgerEntry.insertMany(charlieEntries);
    console.log('✓ Seeded historical ledger entries with exact dates');

    // 3. Verify Shopkeeper Dashboard aggregations match manual calculations
    console.log('\n[3] Testing GET /api/dashboard/shopkeeper and verifying FIFO numbers:');
    const resShopDash = await request(app)
      .get('/api/dashboard/shopkeeper')
      .set('Authorization', `Bearer ${shopkeeperToken}`);

    if (resShopDash.status !== 200) {
      throw new Error(`Shopkeeper dashboard failed: ${JSON.stringify(resShopDash.body)}`);
    }

    const {
      totalOutstandingPaise,
      ageingTotals,
      topDebtors,
      collectionRate,
      trend6Months
    } = resShopDash.body;

    // Expected Manual Calculations:
    // Total Outstanding = ₹400 (Alice) + ₹800 (Bob) + ₹150 (Charlie) = ₹1,350 = 135,000 paise
    console.log(`- Total Outstanding: got ${totalOutstandingPaise} paise (expected 135,000 paise = ₹1,350.00)`);
    if (totalOutstandingPaise !== 135000) {
      throw new Error(`Total outstanding mismatch: expected 135000, got ${totalOutstandingPaise}`);
    }

    // Expected FIFO Ageing Totals:
    // 0-7 days: 20,000 (Alice) + 15,000 (Charlie) = 35,000 paise (₹350.00)
    // 8-30 days: 20,000 (Alice) = 20,000 paise (₹200.00)
    // 30+ days: 80,000 (Bob) = 80,000 paise (₹800.00)
    console.log(`- Ageing 0-7 days: got ${ageingTotals.days0_7Paise} paise (expected 35,000 paise)`);
    console.log(`- Ageing 8-30 days: got ${ageingTotals.days8_30Paise} paise (expected 20,000 paise)`);
    console.log(`- Ageing 30+ days: got ${ageingTotals.days30PlusPaise} paise (expected 80,000 paise)`);

    if (
      ageingTotals.days0_7Paise !== 35000 ||
      ageingTotals.days8_30Paise !== 20000 ||
      ageingTotals.days30PlusPaise !== 80000
    ) {
      throw new Error(`FIFO ageing totals mismatch: ${JSON.stringify(ageingTotals)}`);
    }

    // Expected Top Debtors:
    // #1 Bob (80,000 paise), #2 Alice (40,000 paise), #3 Charlie (15,000 paise)
    console.log(`- Top Debtors: #1 ${topDebtors[0]?.customer?.name} (${topDebtors[0]?.balancePaise} paise), #2 ${topDebtors[1]?.customer?.name} (${topDebtors[1]?.balancePaise} paise), #3 ${topDebtors[2]?.customer?.name} (${topDebtors[2]?.balancePaise} paise)`);
    if (
      topDebtors[0]?.customer?.name !== 'Bob Miller' ||
      topDebtors[0]?.balancePaise !== 80000 ||
      topDebtors[1]?.customer?.name !== 'Alice Johnson' ||
      topDebtors[1]?.balancePaise !== 40000 ||
      topDebtors[2]?.customer?.name !== 'Charlie Davis' ||
      topDebtors[2]?.balancePaise !== 15000
    ) {
      throw new Error(`Top debtors list mismatch: ${JSON.stringify(topDebtors)}`);
    }

    // Expected Collection Rate:
    // Payments: 60,000 paise
    // Credits: 50,000 + 30,000 + 20,000 + 80,000 + 15,000 = 195,000 paise
    // (60,000 / 195,000) * 100 = 30.8%
    console.log(`- Collection Rate: got ${collectionRate}% (expected 30.8%)`);
    if (collectionRate !== 30.8) {
      throw new Error(`Collection rate mismatch: expected 30.8, got ${collectionRate}`);
    }

    // Trend check
    if (!Array.isArray(trend6Months) || trend6Months.length !== 6) {
      throw new Error(`6-month trend array length must be 6, got ${trend6Months?.length}`);
    }
    console.log('✓ All Shopkeeper Dashboard metrics match manual calculations 100%');

    // 4. Verify Customer Dashboard
    console.log('\n[4] Testing GET /api/dashboard/customer for Alice:');
    const resCustDash = await request(app)
      .get('/api/dashboard/customer')
      .set('Authorization', `Bearer ${aliceToken}`);

    if (resCustDash.status !== 200) {
      throw new Error(`Customer dashboard failed: ${JSON.stringify(resCustDash.body)}`);
    }

    // Alice owes ₹400 (40,000 paise)
    console.log(`- Customer total owed: got ${resCustDash.body.totalOwedPaise} paise (expected 40,000 paise)`);
    if (resCustDash.body.totalOwedPaise !== 40000) {
      throw new Error(`Customer total owed mismatch: expected 40000, got ${resCustDash.body.totalOwedPaise}`);
    }
    console.log('✓ Customer dashboard matches manual calculation');

    // 5. Test Filters on Customers (minBalance, sorting)
    console.log('\n[5] Testing Customer filters (minBalance = 50,000 paise):');
    const resMinBal = await request(app)
      .get('/api/accounts?minBalance=50000')
      .set('Authorization', `Bearer ${shopkeeperToken}`);

    // Only Bob has balance >= 50,000 paise (80,000)
    if (resMinBal.status === 200 && resMinBal.body.accounts.length === 1 && resMinBal.body.accounts[0].customer.name === 'Bob Miller') {
      console.log('✓ minBalance filter returned only Bob Miller (80,000 paise >= 50,000 paise)');
    } else {
      throw new Error(`minBalance filter failed: ${JSON.stringify(resMinBal.body)}`);
    }

    // 6. Test Filters on Ledger (type, date range, search)
    console.log('\n[6] Testing Ledger filters (type = payment):');
    const resLedgerFilter = await request(app)
      .get(`/api/ledgers/accounts/${aliceAccountId}?type=payment`)
      .set('Authorization', `Bearer ${shopkeeperToken}`);

    if (resLedgerFilter.status === 200 && resLedgerFilter.body.entries.length === 1 && resLedgerFilter.body.entries[0].type === 'payment') {
      console.log('✓ Ledger filter by type=payment returned single payment entry');
    } else {
      throw new Error(`Ledger type filter failed: ${JSON.stringify(resLedgerFilter.body)}`);
    }

    console.log('\n========================================================================');
    console.log(' ALL PHASE 5 AGEING, FILTERS & DASHBOARD TESTS PASSED (100%)');
    console.log('========================================================================\n');

  } catch (err) {
    console.error('\n❌ Test execution error:', err.message);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  }
}

runPhase5Tests();

