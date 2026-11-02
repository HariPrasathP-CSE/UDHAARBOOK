const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');

let mongoServer;

async function runTests() {
  console.log('--- Starting UdhaarBook Phase 1 Auth & RBAC Verification ---');

  try {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log('✓ In-memory MongoDB connected successfully');

    // 1. Register Shopkeeper
    console.log('\n[1] Testing POST /api/auth/register for shopkeeper:');
    const resShopkeeper = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Ramesh General Store',
        email: 'ramesh@kirana.in',
        phone: '9876543210',
        password: 'password123',
        role: 'shopkeeper'
      });
    
    if (resShopkeeper.status === 201 && resShopkeeper.body.token && resShopkeeper.body.user.role === 'shopkeeper') {
      console.log('✓ Shopkeeper registered successfully (status 201, role: shopkeeper, JWT generated)');
    } else {
      throw new Error(`Failed to register shopkeeper: ${JSON.stringify(resShopkeeper.body)}`);
    }
    const shopkeeperToken = resShopkeeper.body.token;

    // 2. Register Customer
    console.log('\n[2] Testing POST /api/auth/register for customer:');
    const resCustomer = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Anand Kumar',
        email: 'anand@customer.in',
        phone: '9811223344',
        password: 'password123',
        role: 'customer'
      });
    
    if (resCustomer.status === 201 && resCustomer.body.token && resCustomer.body.user.role === 'customer') {
      console.log('✓ Customer registered successfully (status 201, role: customer, JWT generated)');
    } else {
      throw new Error(`Failed to register customer: ${JSON.stringify(resCustomer.body)}`);
    }
    const customerToken = resCustomer.body.token;

    // 3. Register Admin
    console.log('\n[3] Testing POST /api/auth/register for admin:');
    const resAdmin = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Platform Administrator',
        email: 'admin@udhaarbook.in',
        phone: '9900112233',
        password: 'adminpassword123',
        role: 'admin'
      });
    
    if (resAdmin.status === 201 && resAdmin.body.token && resAdmin.body.user.role === 'admin') {
      console.log('✓ Admin registered successfully (status 201, role: admin, JWT generated)');
    } else {
      throw new Error(`Failed to register admin: ${JSON.stringify(resAdmin.body)}`);
    }
    const adminToken = resAdmin.body.token;

    // 4. Duplicate rejection test
    console.log('\n[4] Testing duplicate registration error:');
    const resDup = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Duplicate Ramesh',
        email: 'ramesh@kirana.in',
        phone: '9999999999',
        password: 'password123',
        role: 'shopkeeper'
      });
    if (resDup.status === 400 && resDup.body.success === false) {
      console.log('✓ Duplicate email correctly rejected with 400 Bad Request');
    } else {
      throw new Error(`Duplicate validation failed: ${JSON.stringify(resDup.body)}`);
    }

    // 5. Invalid role rejection test
    console.log('\n[5] Testing invalid role rejection:');
    const resInvalidRole = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Hacker',
        email: 'hacker@test.in',
        phone: '9888888888',
        password: 'password123',
        role: 'supergod'
      });
    if (resInvalidRole.status === 400 && resInvalidRole.body.success === false) {
      console.log('✓ Invalid role rejected with 400 Bad Request');
    } else {
      throw new Error(`Invalid role validation failed: ${JSON.stringify(resInvalidRole.body)}`);
    }

    // 6. Login tests
    console.log('\n[6] Testing POST /api/auth/login:');
    const resLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'ramesh@kirana.in',
        password: 'password123'
      });
    if (resLogin.status === 200 && resLogin.body.token && resLogin.body.user.name === 'Ramesh General Store') {
      console.log('✓ Valid login succeeded (status 200, JWT token returned)');
    } else {
      throw new Error(`Login failed: ${JSON.stringify(resLogin.body)}`);
    }

    const resLoginWrong = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'ramesh@kirana.in',
        password: 'wrongpassword'
      });
    if (resLoginWrong.status === 401 && resLoginWrong.body.success === false) {
      console.log('✓ Invalid password correctly rejected with 401 Unauthorized');
    } else {
      throw new Error(`Invalid password check failed: ${JSON.stringify(resLoginWrong.body)}`);
    }

    // 7. GET /api/auth/me tests
    console.log('\n[7] Testing GET /api/auth/me:');
    const resMe = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${customerToken}`);
    if (resMe.status === 200 && resMe.body.user.email === 'anand@customer.in' && !resMe.body.user.passwordHash) {
      console.log('✓ /api/auth/me retrieved customer profile without passwordHash');
    } else {
      throw new Error(`/api/auth/me failed: ${JSON.stringify(resMe.body)}`);
    }

    const resMeNoToken = await request(app).get('/api/auth/me');
    if (resMeNoToken.status === 401) {
      console.log('✓ /api/auth/me without token rejected with 401 Unauthorized');
    } else {
      throw new Error(`Missing token check failed: ${JSON.stringify(resMeNoToken.body)}`);
    }

    // 8. Role-based Access Control (RBAC) middleware tests
    console.log('\n[8] Testing RBAC requireRole middleware:');
    
    // Shopkeeper accesses shopkeeper-only route -> 200 OK
    const resShopSuccess = await request(app)
      .get('/api/auth/role/shopkeeper')
      .set('Authorization', `Bearer ${shopkeeperToken}`);
    if (resShopSuccess.status === 200) {
      console.log('✓ Shopkeeper permitted on shopkeeper-only route (200 OK)');
    } else {
      throw new Error(`Shopkeeper access check failed: ${resShopSuccess.status}`);
    }

    // Customer accesses shopkeeper-only route -> 403 Forbidden
    const resCustomerBlocked = await request(app)
      .get('/api/auth/role/shopkeeper')
      .set('Authorization', `Bearer ${customerToken}`);
    if (resCustomerBlocked.status === 403) {
      console.log('✓ Customer denied on shopkeeper-only route (403 Forbidden)');
    } else {
      throw new Error(`Customer block check failed: ${resCustomerBlocked.status}`);
    }

    // Customer accesses customer-only route -> 200 OK
    const resCustSuccess = await request(app)
      .get('/api/auth/role/customer')
      .set('Authorization', `Bearer ${customerToken}`);
    if (resCustSuccess.status === 200) {
      console.log('✓ Customer permitted on customer-only route (200 OK)');
    } else {
      throw new Error(`Customer access check failed: ${resCustSuccess.status}`);
    }

    // Admin accesses admin-only route -> 200 OK
    const resAdminSuccess = await request(app)
      .get('/api/auth/role/admin')
      .set('Authorization', `Bearer ${adminToken}`);
    if (resAdminSuccess.status === 200) {
      console.log('✓ Admin permitted on admin-only route (200 OK)');
    } else {
      throw new Error(`Admin access check failed: ${resAdminSuccess.status}`);
    }

    console.log('\n======================================================');
    console.log(' ALL PHASE 1 AUTH & RBAC VERIFICATIONS PASSED (100%)');
    console.log('======================================================\n');

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

runTests();
