const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');

let mongoServer;

async function runPhase3Tests() {
  console.log('--- Starting UdhaarBook Phase 3 Ledger Core Verification ---');

  try {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log('✓ In-memory MongoDB connected successfully');

    // 1. Setup Shopkeeper and Customer
    console.log('\n[1] Registering users and setting up shop & account:');
    const resShopkeeper = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Murugan Supermarket',
        email: 'murugan@store.com',
        phone: '9700000001',
        password: 'password123',
        role: 'shopkeeper'
      });
    const shopkeeperToken = resShopkeeper.body.token;

    const resCustomer = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Vimal Raj',
        email: 'vimal@customer.com',
        phone: '9700000002',
        password: 'password123',
        role: 'customer'
      });
    const customerToken = resCustomer.body.token;

    // Create Shop
    const resShop = await request(app)
      .post('/api/shops')
      .set('Authorization', `Bearer ${shopkeeperToken}`)
      .send({
        name: 'Murugan Supermarket',
        address: '100 Gandhi Road',
        phone: '9700000001'
      });
    const shopId = resShop.body.shop._id;

    // Link Customer with creditLimit = 50,000 paise (₹500.00)
    const resAccount = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${shopkeeperToken}`)
      .send({
        phone: '9700000002',
        creditLimit: 50000 // 50,000 paise = ₹500
      });
    const accountId = resAccount.body.account._id;
    console.log(`✓ Account created: ${accountId} with creditLimit: 50,000 paise (₹500.00)`);

    // 2. Create first credit entry (₹300 = 30,000 paise)
    console.log('\n[2] Testing POST /api/ledgers (Credit entry within limit):');
    const resCredit1 = await request(app)
      .post('/api/ledgers')
      .set('Authorization', `Bearer ${shopkeeperToken}`)
      .send({
        accountId,
        type: 'credit',
        amountPaise: 30000,
        note: 'Rice 5kg, Cooking Oil 1L'
      });
    
    if (
      resCredit1.status === 201 &&
      resCredit1.body.entry.amountPaise === 30000 &&
      resCredit1.body.balancePaise === 30000 &&
      resCredit1.body.limitWarning === false
    ) {
      console.log('✓ Credit entry 1 created: ₹300 (balance: 30,000 paise, limitWarning: false)');
    } else {
      throw new Error(`Credit entry 1 failed: ${JSON.stringify(resCredit1.body)}`);
    }
    const entry1Id = resCredit1.body.entry._id;

    // 3. Create second credit entry that exceeds creditLimit (₹250 = 25,000 paise)
    // New prospective balance: 300 + 250 = ₹550 > ₹500 limit
    console.log('\n[3] Testing POST /api/ledgers (Credit entry exceeding limit -> limitWarning flag):');
    const resCredit2 = await request(app)
      .post('/api/ledgers')
      .set('Authorization', `Bearer ${shopkeeperToken}`)
      .send({
        accountId,
        type: 'credit',
        amountPaise: 25000,
        note: 'Spices and pulses'
      });
    
    if (
      resCredit2.status === 201 &&
      resCredit2.body.balancePaise === 55000 &&
      resCredit2.body.limitWarning === true &&
      resCredit2.body.limitMessage.includes('Limit warning')
    ) {
      console.log('✓ Credit entry 2 created with limitWarning = true (balance: ₹550, limit: ₹500, not blocked)');
    } else {
      throw new Error(`Credit entry 2 limit warning test failed: ${JSON.stringify(resCredit2.body)}`);
    }
    const entry2Id = resCredit2.body.entry._id;

    // 4. Verify balance after 2 credit entries
    console.log('\n[4] Testing GET /api/ledgers/accounts/:accountId/balance:');
    const resBalance1 = await request(app)
      .get(`/api/ledgers/accounts/${accountId}/balance`)
      .set('Authorization', `Bearer ${shopkeeperToken}`);
    
    if (
      resBalance1.status === 200 &&
      resBalance1.body.balance.totalCreditPaise === 55000 &&
      resBalance1.body.totalPaymentPaise === undefined &&
      resBalance1.body.balance.netBalancePaise === 55000 &&
      resBalance1.body.balance.limitExceeded === true
    ) {
      console.log('✓ Balance verified: 55,000 paise (₹550.00), limitExceeded: true');
    } else {
      throw new Error(`Balance check failed: ${JSON.stringify(resBalance1.body)}`);
    }

    // 5. Create payment entry (₹150 = 15,000 paise)
    console.log('\n[5] Testing POST /api/ledgers (Payment entry of ₹150):');
    const resPayment = await request(app)
      .post('/api/ledgers')
      .set('Authorization', `Bearer ${shopkeeperToken}`)
      .send({
        accountId,
        type: 'payment',
        amountPaise: 15000,
        note: 'UPI Payment received'
      });
    
    if (
      resPayment.status === 201 &&
      resPayment.body.entry.type === 'payment' &&
      resPayment.body.balancePaise === 40000 // 55000 - 15000 = 40000 (₹400)
    ) {
      console.log('✓ Payment entry recorded: ₹150 (new balance: 40,000 paise = ₹400.00)');
    } else {
      throw new Error(`Payment entry failed: ${JSON.stringify(resPayment.body)}`);
    }

    // 6. Reverse Entry 2 (the ₹250 credit entry)
    console.log('\n[6] Testing POST /api/ledgers/:id/reverse (Reverse entry 2):');
    const resReverse = await request(app)
      .post(`/api/ledgers/${entry2Id}/reverse`)
      .set('Authorization', `Bearer ${shopkeeperToken}`);
    
    if (
      resReverse.status === 201 &&
      resReverse.body.reversalEntry.type === 'payment' &&
      resReverse.body.reversalEntry.amountPaise === 25000 &&
      resReverse.body.reversalEntry.reversalOf._id === entry2Id &&
      resReverse.body.originalEntry.isReversed === true &&
      resReverse.body.balancePaise === 15000 // Remaining: Entry 1 (30000 credit) - Payment (15000 payment) = 15000 paise (₹150)
    ) {
      console.log('✓ Entry 2 reversed successfully! Balance updated to 15,000 paise (₹150.00)');
    } else {
      throw new Error(`Reverse entry failed: ${JSON.stringify(resReverse.body)}`);
    }

    // 7. Verify balance exclusion of reversed pairs
    console.log('\n[7] Verifying aggregation excludes reversed pairs:');
    const resBalanceAfterReverse = await request(app)
      .get(`/api/ledgers/accounts/${accountId}/balance`)
      .set('Authorization', `Bearer ${shopkeeperToken}`);
    
    // Active entries: Entry 1 (credit 30,000), Payment (payment 15,000)
    // Excluded pair: Entry 2 (credit 25,000 reversed) and Reversal (payment 25,000)
    if (
      resBalanceAfterReverse.status === 200 &&
      resBalanceAfterReverse.body.balance.totalCreditPaise === 30000 &&
      resBalanceAfterReverse.body.balance.totalPaymentPaise === 15000 &&
      resBalanceAfterReverse.body.balance.netBalancePaise === 15000 &&
      resBalanceAfterReverse.body.balance.limitExceeded === false
    ) {
      console.log('✓ Aggregation correctly excludes reversed pair: Active Credits = ₹300, Active Payments = ₹150, Net Balance = ₹150');
    } else {
      throw new Error(`Balance after reversal verification failed: ${JSON.stringify(resBalanceAfterReverse.body)}`);
    }

    // 8. Prevent duplicate reversal of already reversed entry
    console.log('\n[8] Testing duplicate reversal prevention:');
    const resDupReverse = await request(app)
      .post(`/api/ledgers/${entry2Id}/reverse`)
      .set('Authorization', `Bearer ${shopkeeperToken}`);
    if (resDupReverse.status === 400) {
      console.log('✓ Duplicate reversal rejected with 400 Bad Request');
    } else {
      throw new Error(`Duplicate reversal check failed: status ${resDupReverse.status}`);
    }

    // 9. Customer views account ledger (Read-only view)
    console.log('\n[9] Testing Customer GET /api/ledgers/accounts/:accountId (Read-only ledger view):');
    const resCustomerLedger = await request(app)
      .get(`/api/ledgers/accounts/${accountId}`)
      .set('Authorization', `Bearer ${customerToken}`);
    
    if (
      resCustomerLedger.status === 200 &&
      resCustomerLedger.body.entries.length === 4 &&
      resCustomerLedger.body.balance.netBalancePaise === 15000
    ) {
      console.log('✓ Customer retrieved complete ledger with 4 audit entries and verified balance ₹150');
    } else {
      throw new Error(`Customer ledger retrieval failed: ${JSON.stringify(resCustomerLedger.body)}`);
    }

    // 10. Customer attempts to create entry (Forbidden)
    console.log('\n[10] Testing Customer creating entry (RBAC check):');
    const resCustCreate = await request(app)
      .post('/api/ledgers')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        accountId,
        type: 'credit',
        amountPaise: 10000
      });
    if (resCustCreate.status === 403) {
      console.log('✓ Customer forbidden from creating ledger entries (403 Forbidden)');
    } else {
      throw new Error(`RBAC check failed: status ${resCustCreate.status}`);
    }

    console.log('\n=============================================================');
    console.log(' ALL PHASE 3 LEDGER CORE VERIFICATIONS PASSED (100%)');
    console.log('=============================================================\n');

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

runPhase3Tests();

