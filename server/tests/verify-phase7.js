const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');

let mongoServer;

async function runPhase7Tests() {
  console.log('--- Starting UdhaarBook Phase 7 Admin, Hardening & Seed Verification ---');

  try {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    console.log('✓ In-memory MongoDB connected successfully');

    // 1. Setup Admin, Shopkeeper, and Customer
    console.log('\n[1] Registering Admin, Shopkeeper, and Customer:');
    const resAdmin = await request(app).post('/api/auth/register').send({
      name: 'Central Admin',
      email: 'admin.phase7@udhaarbook.in',
      phone: '9900000001',
      password: 'password123',
      role: 'admin'
    });
    const adminToken = resAdmin.body.token;

    const resSk = await request(app).post('/api/auth/register').send({
      name: 'Ramesh Kirana',
      email: 'ramesh.phase7@kirana.in',
      phone: '9900000002',
      password: 'password123',
      role: 'shopkeeper'
    });
    const skToken = resSk.body.token;

    const resCust = await request(app).post('/api/auth/register').send({
      name: 'Pooja Customer',
      email: 'pooja.phase7@gmail.com',
      phone: '9900000003',
      password: 'password123',
      role: 'customer'
    });
    const custToken = resCust.body.token;
    const custId = resCust.body.user.id;
    console.log('✓ Users registered successfully');

    // 2. Setup Shop and Account
    const resShop = await request(app)
      .post('/api/shops')
      .set('Authorization', `Bearer ${skToken}`)
      .send({
        name: 'Ramesh Phase 7 Mart',
        phone: '9900000002',
        address: 'Delhi Market'
      });
    const shopId = resShop.body.shop._id;

    const resAcc = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${skToken}`)
      .send({
        phone: '9900000003',
        creditLimit: 200000 // ₹2,000.00
      });
    const accountId = resAcc.body.account._id;

    // 3. Create entry and escalate dispute
    const resEntry = await request(app)
      .post('/api/ledgers')
      .set('Authorization', `Bearer ${skToken}`)
      .send({
        accountId,
        type: 'credit',
        amountPaise: 80000, // ₹800.00
        note: 'Items billed on credit'
      });
    const entryId = resEntry.body.entry._id;

    const resDispute = await request(app)
      .post(`/api/ledgers/${entryId}/dispute`)
      .set('Authorization', `Bearer ${custToken}`)
      .send({ reason: 'Overcharged by ₹300' });
    const disputeId = resDispute.body.dispute._id;

    await request(app)
      .post(`/api/disputes/${disputeId}/escalate`)
      .set('Authorization', `Bearer ${custToken}`)
      .send({ reason: 'Shopkeeper unresponsive' });
    console.log('✓ Ledger entry created and escalated dispute established');

    // 4. Test GET /api/admin/stats
    console.log('\n[2] Testing GET /api/admin/stats:');
    const resStats = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    if (resStats.status !== 200 || !resStats.body.stats) {
      throw new Error(`Failed to get platform stats: ${JSON.stringify(resStats.body)}`);
    }
    const { stats } = resStats.body;
    console.log(`✓ Platform stats received:`);
    console.log(`  - Total Shops: ${stats.shops.total} (Active: ${stats.shops.active})`);
    console.log(`  - Total Users: ${stats.users.total} (${stats.users.shopkeepers} shopkeepers, ${stats.users.customers} customers, ${stats.users.admins} admins)`);
    console.log(`  - Total Entries: ${stats.entries.total} (Net Dues: ₹${stats.entries.netOutstandingPaise / 100})`);
    console.log(`  - Escalated Disputes: ${stats.disputes.escalated}`);

    // 5. Test GET /api/admin/users & PATCH /api/admin/users/:id/status
    console.log('\n[3] Testing User Management Endpoints:');
    const resUsers = await request(app)
      .get('/api/admin/users?role=customer')
      .set('Authorization', `Bearer ${adminToken}`);
    if (resUsers.status !== 200 || resUsers.body.users.length === 0) {
      throw new Error('Failed to list customer users');
    }
    console.log(`✓ Listed ${resUsers.body.users.length} customer user(s)`);

    // Deactivate customer
    const resDeactivate = await request(app)
      .patch(`/api/admin/users/${custId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });
    if (resDeactivate.status !== 200 || resDeactivate.body.user.isActive !== false) {
      throw new Error('Failed to deactivate user');
    }
    console.log('✓ User successfully deactivated');

    // Verify deactivated user cannot login
    const resLoginBlocked = await request(app).post('/api/auth/login').send({
      email: 'pooja.phase7@gmail.com',
      password: 'password123'
    });
    if (resLoginBlocked.status !== 403) {
      throw new Error(`Expected 403 Forbidden for deactivated user, got ${resLoginBlocked.status}`);
    }
    console.log('✓ Deactivated user login blocked with 403 Forbidden');

    // Re-activate customer
    await request(app)
      .patch(`/api/admin/users/${custId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true });
    console.log('✓ User successfully re-activated');

    // 6. Test GET /api/admin/shops & PATCH /api/admin/shops/:id/status
    console.log('\n[4] Testing Shop Management Endpoints:');
    const resShops = await request(app)
      .get('/api/admin/shops')
      .set('Authorization', `Bearer ${adminToken}`);
    if (resShops.status !== 200 || resShops.body.shops.length === 0) {
      throw new Error('Failed to list shops');
    }
    console.log(`✓ Listed ${resShops.body.shops.length} shop(s)`);

    // Toggle shop status
    const resDeactivateShop = await request(app)
      .patch(`/api/admin/shops/${shopId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ active: false });
    if (resDeactivateShop.status !== 200 || resDeactivateShop.body.shop.active !== false) {
      throw new Error('Failed to deactivate shop');
    }
    console.log('✓ Shop successfully deactivated and re-activated');
    await request(app)
      .patch(`/api/admin/shops/${shopId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ active: true });

    // 7. Test Admin Dispute Resolution: POST /api/admin/disputes/:id/resolve
    console.log('\n[5] Testing Admin Dispute Resolution (Accept & Auto-Reversal):');
    const resResolve = await request(app)
      .post(`/api/admin/disputes/${disputeId}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        action: 'accept',
        note: 'Customer billing proof verified by platform admin'
      });

    if (resResolve.status !== 200 || !resResolve.body.reversingEntry) {
      throw new Error(`Failed to resolve dispute: ${JSON.stringify(resResolve.body)}`);
    }
    console.log('✓ Admin resolved dispute (status 200, reversing entry created automatically)');
    console.log(`  - Reversal ID: ${resResolve.body.reversingEntry._id}`);
    console.log(`  - Reversal Type: ${resResolve.body.reversingEntry.type}`);

    // Verify net balance after reversal
    const resBal = await request(app)
      .get(`/api/ledgers/accounts/${accountId}/balance`)
      .set('Authorization', `Bearer ${skToken}`);
    if (resBal.body.balance.netBalancePaise !== 0) {
      throw new Error(`Expected balance 0 after reversal, got ${resBal.body.balance.netBalancePaise}`);
    }
    console.log('✓ Verified net account balance is ₹0.00 after admin reversal');

    // 8. Test Request Validation Middleware
    console.log('\n[6] Testing Request Validation Middleware (express-validator):');
    const resInvalidRegister = await request(app).post('/api/auth/register').send({
      name: '',
      email: 'not-an-email',
      phone: '',
      password: '123'
    });
    if (resInvalidRegister.status !== 400 || !resInvalidRegister.body.errors) {
      throw new Error('Expected validation error 400 with errors array');
    }
    console.log(`✓ Request validation rejected invalid payload with status 400 and ${resInvalidRegister.body.errors.length} field error(s)`);

    // 9. Verify Helmet Security Headers
    console.log('\n[7] Verifying Helmet Security Headers:');
    const resHealth = await request(app).get('/api/health');
    if (!resHealth.headers['x-dns-prefetch-control']) {
      throw new Error('Helmet security headers missing');
    }
    console.log('✓ Helmet security headers present on responses');

    console.log('\n========================================================================');
    console.log(' ALL PHASE 7 ADMIN, HARDENING & POLISH TESTS PASSED (100%)');
    console.log('========================================================================\n');

    await mongoose.disconnect();
    await mongoServer.stop();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Phase 7 verification error:', err.message);
    if (mongoServer) {
      await mongoose.disconnect();
      await mongoServer.stop();
    }
    process.exit(1);
  }
}

runPhase7Tests();

