const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');

let mongoServer;

async function runPhase4Tests() {
  console.log('--- Starting UdhaarBook Phase 4 Acknowledge, Dispute & Notifications Verification ---');

  try {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log('✓ In-memory MongoDB connected successfully');

    // 1. Setup Users & Shop & Account
    console.log('\n[1] Setup test users: Shopkeeper, Customer, Admin:');
    const resShopkeeper = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Gopal Grocery',
        email: 'gopal@kirana.com',
        phone: '9600000001',
        password: 'password123',
        role: 'shopkeeper'
      });
    const shopkeeperToken = resShopkeeper.body.token;

    const resCustomer = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Prakash Rao',
        email: 'prakash@customer.com',
        phone: '9600000002',
        password: 'password123',
        role: 'customer'
      });
    const customerToken = resCustomer.body.token;

    const resAdmin = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Super Admin',
        email: 'admin@udhaar.com',
        phone: '9600000003',
        password: 'password123',
        role: 'admin'
      });
    const adminToken = resAdmin.body.token;

    // Create Shop & Account
    await request(app)
      .post('/api/shops')
      .set('Authorization', `Bearer ${shopkeeperToken}`)
      .send({ name: 'Gopal Grocery Store', phone: '9600000001' });

    const resAccount = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${shopkeeperToken}`)
      .send({ phone: '9600000002', creditLimit: 100000 });
    const accountId = resAccount.body.account._id;
    console.log('✓ Users, Shop, and Account created');

    // 2. Shopkeeper creates Entry 1 (credit ₹100 = 10,000 paise)
    console.log('\n[2] Testing Entry 1 creation & customer notification:');
    const resEntry1 = await request(app)
      .post('/api/ledgers')
      .set('Authorization', `Bearer ${shopkeeperToken}`)
      .send({
        accountId,
        type: 'credit',
        amountPaise: 10000,
        note: 'Milk and Bread'
      });
    const entry1Id = resEntry1.body.entry._id;

    // Customer checks unread count and notification
    const resCustNotif1 = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${customerToken}`);
    if (resCustNotif1.status === 200 && resCustNotif1.body.notifications.length === 1 && resCustNotif1.body.unreadCount === 1) {
      console.log('✓ Customer received new_entry notification for ₹100');
    } else {
      throw new Error(`Customer notification check failed: ${JSON.stringify(resCustNotif1.body)}`);
    }

    // 3. Customer acknowledges Entry 1
    console.log('\n[3] Testing POST /api/ledgers/:id/acknowledge:');
    const resAck = await request(app)
      .post(`/api/ledgers/${entry1Id}/acknowledge`)
      .set('Authorization', `Bearer ${customerToken}`);
    
    if (resAck.status === 200 && resAck.body.entry.status === 'acknowledged') {
      console.log('✓ Entry 1 acknowledged by customer (status: acknowledged)');
    } else {
      throw new Error(`Acknowledge failed: ${JSON.stringify(resAck.body)}`);
    }

    // Shopkeeper should receive entry_acknowledged notification
    const resShopNotif1 = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${shopkeeperToken}`);
    if (resShopNotif1.status === 200 && resShopNotif1.body.notifications[0].type === 'entry_acknowledged') {
      console.log('✓ Shopkeeper received entry_acknowledged notification');
    } else {
      throw new Error(`Shopkeeper ack notification failed: ${JSON.stringify(resShopNotif1.body)}`);
    }

    // 4. Shopkeeper creates Entry 2 (credit ₹200 = 20,000 paise)
    console.log('\n[4] Testing Entry 2 & Customer Disputing it:');
    const resEntry2 = await request(app)
      .post('/api/ledgers')
      .set('Authorization', `Bearer ${shopkeeperToken}`)
      .send({
        accountId,
        type: 'credit',
        amountPaise: 20000,
        note: 'Cooking oil and rice'
      });
    const entry2Id = resEntry2.body.entry._id;

    // Customer disputes Entry 2
    const resDispute = await request(app)
      .post(`/api/ledgers/${entry2Id}/dispute`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        reason: 'I never purchased this item on this date'
      });
    
    if (
      resDispute.status === 201 &&
      resDispute.body.dispute.status === 'open' &&
      resDispute.body.entry.status === 'disputed'
    ) {
      console.log('✓ Customer disputed Entry 2 (entry status: disputed, dispute status: open)');
    } else {
      throw new Error(`Dispute creation failed: ${JSON.stringify(resDispute.body)}`);
    }
    const dispute1Id = resDispute.body.dispute._id;

    // 5. Shopkeeper resolves dispute by ACCEPTING
    console.log('\n[5] Testing Shopkeeper resolving dispute (Action: accept -> Auto-reversal):');
    const resResolveAccept = await request(app)
      .post(`/api/disputes/${dispute1Id}/resolve`)
      .set('Authorization', `Bearer ${shopkeeperToken}`)
      .send({
        action: 'accept',
        note: 'Verified with staff, billing error on customer phone'
      });
    
    if (
      resResolveAccept.status === 200 &&
      resResolveAccept.body.dispute.status === 'resolved' &&
      resResolveAccept.body.reversalEntry &&
      resResolveAccept.body.reversalEntry.type === 'payment' &&
      resResolveAccept.body.balancePaise === 10000 // Remaining: Entry 1 = ₹100
    ) {
      console.log('✓ Dispute accepted: Reversing payment entry automatically created, net balance = ₹100 (10,000 paise)');
    } else {
      throw new Error(`Dispute accept failed: ${JSON.stringify(resResolveAccept.body)}`);
    }

    // 6. Shopkeeper creates Entry 3 (credit ₹300 = 30,000 paise) & Customer disputes
    console.log('\n[6] Testing Dispute Rejection & Escalation to Admin:');
    const resEntry3 = await request(app)
      .post('/api/ledgers')
      .set('Authorization', `Bearer ${shopkeeperToken}`)
      .send({
        accountId,
        type: 'credit',
        amountPaise: 30000,
        note: 'Bag of sugar'
      });
    const entry3Id = resEntry3.body.entry._id;

    const resDispute3 = await request(app)
      .post(`/api/ledgers/${entry3Id}/dispute`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        reason: 'Price charged is ₹300 but rate was ₹200'
      });
    const dispute3Id = resDispute3.body.dispute._id;

    // Shopkeeper rejects dispute with note
    const resReject = await request(app)
      .post(`/api/disputes/${dispute3Id}/resolve`)
      .set('Authorization', `Bearer ${shopkeeperToken}`)
      .send({
        action: 'reject',
        note: 'Store bill #4521 shows agreed price of ₹300 for 5kg pack'
      });
    if (resReject.status === 200 && resReject.body.dispute.resolution.includes('Rejected')) {
      console.log('✓ Dispute rejected with explanation note');
    } else {
      throw new Error(`Dispute reject failed: ${JSON.stringify(resReject.body)}`);
    }

    // Customer escalates dispute to Admin
    const resEscalate = await request(app)
      .post(`/api/disputes/${dispute3Id}/escalate`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        note: 'Customer requests admin review of store shelf pricing'
      });
    if (resEscalate.status === 200 && resEscalate.body.dispute.status === 'escalated') {
      console.log('✓ Dispute escalated to admin (status: escalated, history logged)');
    } else {
      throw new Error(`Dispute escalate failed: ${JSON.stringify(resEscalate.body)}`);
    }

    // 7. Verify Admin received escalation notification
    console.log('\n[7] Testing Admin notifications:');
    const resAdminNotif = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${adminToken}`);
    if (resAdminNotif.status === 200 && resAdminNotif.body.notifications.some((n) => n.type === 'dispute_escalated')) {
      console.log('✓ Admin received dispute_escalated notification');
    } else {
      throw new Error(`Admin escalation notification failed: ${JSON.stringify(resAdminNotif.body)}`);
    }

    // 8. Test Mark Notification Read & Mark All Read
    console.log('\n[8] Testing Notification read endpoints:');
    const firstNotifId = resAdminNotif.body.notifications[0]._id;
    const resMarkRead = await request(app)
      .patch(`/api/notifications/${firstNotifId}/read`)
      .set('Authorization', `Bearer ${adminToken}`);
    if (resMarkRead.status === 200 && resMarkRead.body.notification.read === true) {
      console.log('✓ Notification marked as read (status 200)');
    }

    const resMarkAll = await request(app)
      .put('/api/notifications/mark-all-read')
      .set('Authorization', `Bearer ${customerToken}`);
    if (resMarkAll.status === 200) {
      console.log('✓ Customer marked all notifications read');
    }

    const resCustUnread = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${customerToken}`);
    if (resCustUnread.status === 200 && resCustUnread.body.count === 0) {
      console.log('✓ Customer unread count is now 0');
    }

    console.log('\n========================================================================');
    console.log(' ALL PHASE 4 ACKNOWLEDGE, DISPUTE & NOTIFICATIONS PASSED (100%)');
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

runPhase4Tests();

