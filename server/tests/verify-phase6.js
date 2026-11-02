const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const Reminder = require('../src/models/Reminder');
const Notification = require('../src/models/Notification');
const { runDailyReminderJob } = require('../src/jobs/reminderJob');

let mongoServer;

async function runTests() {
  console.log('--- Starting UdhaarBook Phase 6 Reminders, Email & Statements Verification ---');

  try {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log('✓ In-memory MongoDB connected successfully');

    // 1. Setup Shopkeeper, Customer 1, and unauthorized Customer 2
    console.log('\n[1] Registering users & setting up store:');
    const resShopkeeper = await request(app).post('/api/auth/register').send({
      name: 'Ramesh Gupta',
      email: 'ramesh.gupta@kirana.in',
      phone: '9811122233',
      password: 'password123',
      role: 'shopkeeper'
    });
    const skToken = resShopkeeper.body.token;

    const resCustomer1 = await request(app).post('/api/auth/register').send({
      name: 'Vikas Sharma',
      email: 'vikas.sharma@example.com',
      phone: '9844455566',
      password: 'password123',
      role: 'customer'
    });
    const c1Token = resCustomer1.body.token;
    const c1Id = resCustomer1.body.user.id;

    const resCustomer2 = await request(app).post('/api/auth/register').send({
      name: 'Pooja Verma',
      email: 'pooja.verma@example.com',
      phone: '9877788899',
      password: 'password123',
      role: 'customer'
    });
    const c2Token = resCustomer2.body.token;

    // Create shop
    const resShop = await request(app)
      .post('/api/shops')
      .set('Authorization', `Bearer ${skToken}`)
      .send({
        name: 'Gupta Daily Mart',
        address: 'Plot 12, Main Market, Delhi',
        phone: '9811122233'
      });
    const shopId = resShop.body.shop._id;

    // Link Customer 1
    const resAcc = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${skToken}`)
      .send({
        phone: '9844455566',
        creditLimit: 100000 // ₹1,000.00
      });
    const accountId = resAcc.body.account._id;
    console.log(`✓ Shopkeeper, Customer, and Account created (Acc ID: ${accountId})`);

    // 2. Test Reminder Settings Endpoints
    console.log('\n[2] Testing GET & PUT /api/reminders/settings:');
    const resGetSettings = await request(app)
      .get('/api/reminders/settings')
      .set('Authorization', `Bearer ${skToken}`);
    if (resGetSettings.status !== 200 || resGetSettings.body.settings.enabled !== false) {
      throw new Error(`Expected default settings with enabled=false: ${JSON.stringify(resGetSettings.body)}`);
    }

    const resUpdateSettings = await request(app)
      .put('/api/reminders/settings')
      .set('Authorization', `Bearer ${skToken}`)
      .send({
        enabled: true,
        frequencyDays: 5,
        minOverdueDays: 7,
        messageTemplate: 'Namaste {customerName}, reminder of overdue ₹{amount} at {shopName}.'
      });

    if (
      resUpdateSettings.status !== 200 ||
      resUpdateSettings.body.settings.enabled !== true ||
      resUpdateSettings.body.settings.frequencyDays !== 5
    ) {
      throw new Error(`Failed to update reminder settings: ${JSON.stringify(resUpdateSettings.body)}`);
    }
    console.log('✓ Reminder settings successfully updated (enabled: true, frequency: 5 days, minOverdue: 7 days)');

    // 3. Seed dated ledger entries for Customer 1
    console.log('\n[3] Seeding overdue ledger entries:');
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const resCredit = await request(app)
      .post('/api/ledgers')
      .set('Authorization', `Bearer ${skToken}`)
      .send({
        accountId,
        type: 'credit',
        amountPaise: 45000, // ₹450.00
        note: 'Grocery purchase on credit',
        entryDate: tenDaysAgo.toISOString()
      });
    if (resCredit.status !== 201) {
      throw new Error(`Failed to create credit entry: ${JSON.stringify(resCredit.body)}`);
    }
    console.log('✓ Created 10-day overdue credit entry of ₹450.00 (45,000 paise)');

    // 4. Test Manual Reminder Endpoint: POST /api/reminders/accounts/:accountId/send
    console.log('\n[4] Testing POST /api/reminders/accounts/:accountId/send:');
    const resSendReminder = await request(app)
      .post(`/api/reminders/accounts/${accountId}/send`)
      .set('Authorization', `Bearer ${skToken}`)
      .send({
        message: 'Dear Vikas, please clear your outstanding dues of ₹450.00 at Gupta Daily Mart.'
      });

    if (resSendReminder.status !== 200 || !resSendReminder.body.reminder) {
      throw new Error(`Failed to send manual reminder: ${JSON.stringify(resSendReminder.body)}`);
    }
    console.log('✓ Manual reminder successfully triggered (status 200)');
    console.log(`  - Reminder ID: ${resSendReminder.body.reminder._id}`);
    console.log(`  - Amount: ₹${resSendReminder.body.reminder.amountPaise / 100}`);

    // Check Customer received in-app Notification
    const resCustNotifs = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${c1Token}`);
    const reminderNotif = resCustNotifs.body.notifications.find((n) => n.type === 'payment_reminder');
    if (!reminderNotif) {
      throw new Error('Customer did not receive payment_reminder in-app notification');
    }
    console.log(`✓ Customer received in-app notification: "${reminderNotif.title}"`);

    // 5. Test Reminder History endpoint
    console.log('\n[5] Testing GET /api/reminders/accounts/:accountId:');
    const resHistory = await request(app)
      .get(`/api/reminders/accounts/${accountId}`)
      .set('Authorization', `Bearer ${skToken}`);
    if (resHistory.status !== 200 || resHistory.body.reminders.length === 0) {
      throw new Error(`Failed to fetch reminder history: ${JSON.stringify(resHistory.body)}`);
    }
    console.log(`✓ Reminder history contains ${resHistory.body.reminders.length} logged record(s)`);

    // 6. Test Automated Daily Reminder Job & Frequency Window Skip
    console.log('\n[6] Testing automated daily reminder job & frequency window:');
    // First run: Customer was just reminded today, frequency window is 5 days -> should be skipped!
    const stats1 = await runDailyReminderJob();
    console.log(`  - Job run 1: sent=${stats1.remindersSent}, skipped=${stats1.remindersSkipped}`);
    if (stats1.remindersSkipped === 0) {
      throw new Error('Expected reminder to be skipped within the 5-day frequency window');
    }
    console.log('✓ Automated job correctly skipped customer within the 5-day frequency window');

    // Now simulate reminder sent 6 days ago (outside 5-day window)
    await Reminder.updateMany(
      { account: accountId },
      { $set: { sentAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) } }
    );
    const stats2 = await runDailyReminderJob();
    console.log(`  - Job run 2 (after window elapsed): sent=${stats2.remindersSent}, skipped=${stats2.remindersSkipped}`);
    if (stats2.remindersSent === 0) {
      throw new Error('Expected automated job to send reminder after frequency window elapsed');
    }
    console.log('✓ Automated job sent reminder once frequency window elapsed');

    // 7. Testing Statement PDF Generation: GET /api/accounts/:id/statement
    console.log('\n[7] Testing GET /api/accounts/:id/statement?month=YYYY-MM (PDF generation):');
    const currentMonth = new Date().toISOString().slice(0, 7);

    // Shopkeeper download
    const resShopkeeperPDF = await request(app)
      .get(`/api/accounts/${accountId}/statement?month=${currentMonth}`)
      .set('Authorization', `Bearer ${skToken}`)
      .responseType('blob');

    if (resShopkeeperPDF.status !== 200) {
      throw new Error(`Shopkeeper statement download failed with status ${resShopkeeperPDF.status}`);
    }
    if (resShopkeeperPDF.headers['content-type'] !== 'application/pdf') {
      throw new Error(`Expected Content-Type application/pdf, got: ${resShopkeeperPDF.headers['content-type']}`);
    }
    const pdfBufferSK = Buffer.from(resShopkeeperPDF.body);
    const isPDFValidSK = pdfBufferSK.toString('utf8', 0, 4) === '%PDF';
    if (!isPDFValidSK) {
      throw new Error('Generated file does not start with %PDF header');
    }
    console.log(`✓ Shopkeeper downloaded statement PDF (${pdfBufferSK.length} bytes, valid %PDF header)`);

    // Customer download
    const resCustomerPDF = await request(app)
      .get(`/api/accounts/${accountId}/statement?month=${currentMonth}`)
      .set('Authorization', `Bearer ${c1Token}`)
      .responseType('blob');

    if (resCustomerPDF.status !== 200) {
      throw new Error(`Customer statement download failed with status ${resCustomerPDF.status}`);
    }
    const pdfBufferCust = Buffer.from(resCustomerPDF.body);
    if (pdfBufferCust.toString('utf8', 0, 4) !== '%PDF') {
      throw new Error('Customer PDF does not start with %PDF header');
    }
    console.log(`✓ Customer successfully downloaded own statement PDF (${pdfBufferCust.length} bytes)`);

    // Unauthorized Customer 2 download attempt (should be 403 Forbidden)
    const resForbiddenPDF = await request(app)
      .get(`/api/accounts/${accountId}/statement?month=${currentMonth}`)
      .set('Authorization', `Bearer ${c2Token}`);

    if (resForbiddenPDF.status !== 403) {
      throw new Error(`Expected status 403 for unauthorized customer, got: ${resForbiddenPDF.status}`);
    }
    console.log('✓ Unauthorized customer 2 correctly denied access to statement (403 Forbidden)');

    console.log('\n========================================================================');
    console.log(' ALL PHASE 6 REMINDERS, EMAIL & STATEMENTS TESTS PASSED (100%)');
    console.log('========================================================================\n');

    await mongoose.disconnect();
    await mongoServer.stop();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Phase 6 verification error:', err.message);
    if (mongoServer) {
      await mongoose.disconnect();
      await mongoServer.stop();
    }
    process.exit(1);
  }
}

runTests();
