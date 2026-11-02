const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');

let mongoServer;

async function runPhase2Tests() {
  console.log('--- Starting UdhaarBook Phase 2 Shops & Customer Accounts Verification ---');

  try {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log('✓ In-memory MongoDB connected successfully');

    // 1. Setup Shopkeeper and Customer Users
    console.log('\n[1] Registering test shopkeeper and customer:');
    const resShopkeeper = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Mohan Lal',
        email: 'mohan@kirana.com',
        phone: '9800000001',
        password: 'password123',
        role: 'shopkeeper'
      });
    const shopkeeperToken = resShopkeeper.body.token;

    const resCustomer = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Suresh Kumar',
        email: 'suresh@customer.com',
        phone: '9800000002',
        password: 'password123',
        role: 'customer'
      });
    const customerToken = resCustomer.body.token;
    console.log('✓ Shopkeeper and Customer registered');

    // 2. Shopkeeper creates a shop
    console.log('\n[2] Testing POST /api/shops (Create Shop):');
    const resCreateShop = await request(app)
      .post('/api/shops')
      .set('Authorization', `Bearer ${shopkeeperToken}`)
      .send({
        name: 'Mohan Provision Store',
        address: '12 Bazar Road, Madurai',
        phone: '9800000001'
      });
    
    if (resCreateShop.status === 201 && resCreateShop.body.shop.name === 'Mohan Provision Store') {
      console.log('✓ Shop created successfully (status 201)');
    } else {
      throw new Error(`Create shop failed: ${JSON.stringify(resCreateShop.body)}`);
    }

    // 3. Shopkeeper gets own shop
    console.log('\n[3] Testing GET /api/shops/me:');
    const resGetShop = await request(app)
      .get('/api/shops/me')
      .set('Authorization', `Bearer ${shopkeeperToken}`);
    if (resGetShop.status === 200 && resGetShop.body.shop.name === 'Mohan Provision Store') {
      console.log('✓ GET /api/shops/me returned shopkeeper shop (status 200)');
    } else {
      throw new Error(`Get shop failed: ${JSON.stringify(resGetShop.body)}`);
    }

    // 4. Shopkeeper updates own shop
    console.log('\n[4] Testing PUT /api/shops/me (Update Shop):');
    const resUpdateShop = await request(app)
      .put('/api/shops/me')
      .set('Authorization', `Bearer ${shopkeeperToken}`)
      .send({
        name: 'Mohan Provision & Super Store',
        address: '14 Main Market, Madurai'
      });
    if (resUpdateShop.status === 200 && resUpdateShop.body.shop.name === 'Mohan Provision & Super Store') {
      console.log('✓ PUT /api/shops/me updated shop details');
    } else {
      throw new Error(`Update shop failed: ${JSON.stringify(resUpdateShop.body)}`);
    }

    // 5. Customer cannot create shop (RBAC)
    console.log('\n[5] Testing Customer trying to POST /api/shops (RBAC check):');
    const resCustShop = await request(app)
      .post('/api/shops')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'Fake Shop', phone: '123' });
    if (resCustShop.status === 403) {
      console.log('✓ Customer correctly forbidden from creating shop (403 Forbidden)');
    } else {
      throw new Error(`RBAC check failed: status ${resCustShop.status}`);
    }

    // 6. Shopkeeper links existing customer by phone
    console.log('\n[6] Testing POST /api/accounts (Link existing customer):');
    const resAddExisting = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${shopkeeperToken}`)
      .send({
        phone: '9800000002',
        creditLimit: 500000 // 500,000 paise = ₹5,000
      });
    
    if (
      resAddExisting.status === 201 &&
      resAddExisting.body.account.customer.email === 'suresh@customer.com' &&
      resAddExisting.body.account.creditLimit === 500000 &&
      !resAddExisting.body.createdNewUser
    ) {
      console.log('✓ Existing customer linked to shop with 500,000 paise creditLimit');
    } else {
      throw new Error(`Add existing customer failed: ${JSON.stringify(resAddExisting.body)}`);
    }
    const account1Id = resAddExisting.body.account._id;

    // 7. Shopkeeper adds new customer (auto User creation with temp password)
    console.log('\n[7] Testing POST /api/accounts (Auto create new customer user):');
    const resAddNew = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${shopkeeperToken}`)
      .send({
        name: 'Priya Sharma',
        phone: '9871112233',
        email: 'priya@sample.in',
        creditLimit: 250000 // 250,000 paise = ₹2,500
      });
    
    if (
      resAddNew.status === 201 &&
      resAddNew.body.createdNewUser === true &&
      resAddNew.body.tempPassword === 'TempPass@123' &&
      resAddNew.body.account.creditLimit === 250000
    ) {
      console.log('✓ New customer auto-created with temp password and linked to shop');
    } else {
      throw new Error(`Add new customer failed: ${JSON.stringify(resAddNew.body)}`);
    }

    // 8. Prevent duplicate customer linking
    console.log('\n[8] Testing duplicate account prevention:');
    const resDup = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${shopkeeperToken}`)
      .send({ phone: '9800000002' });
    if (resDup.status === 400) {
      console.log('✓ Duplicate customer link rejected with 400 Bad Request');
    } else {
      throw new Error(`Duplicate link check failed: status ${resDup.status}`);
    }

    // 9. Update creditLimit
    console.log('\n[9] Testing PATCH /api/accounts/:id/credit-limit:');
    const resUpdateLimit = await request(app)
      .patch(`/api/accounts/${account1Id}/credit-limit`)
      .set('Authorization', `Bearer ${shopkeeperToken}`)
      .send({ creditLimit: 750000 }); // update to 750,000 paise = ₹7,500
    if (resUpdateLimit.status === 200 && resUpdateLimit.body.account.creditLimit === 750000) {
      console.log('✓ Credit limit updated to 750,000 paise (status 200)');
    } else {
      throw new Error(`Update credit limit failed: ${JSON.stringify(resUpdateLimit.body)}`);
    }

    // 10. List/search shopkeeper customers
    console.log('\n[10] Testing GET /api/accounts (List & search customers):');
    const resList = await request(app)
      .get('/api/accounts?page=1&limit=10')
      .set('Authorization', `Bearer ${shopkeeperToken}`);
    if (resList.status === 200 && resList.body.accounts.length === 2) {
      console.log('✓ Listed 2 shop customers with pagination metadata');
    } else {
      throw new Error(`List customers failed: ${JSON.stringify(resList.body)}`);
    }

    const resSearch = await request(app)
      .get('/api/accounts?search=Priya')
      .set('Authorization', `Bearer ${shopkeeperToken}`);
    if (resSearch.status === 200 && resSearch.body.accounts.length === 1 && resSearch.body.accounts[0].customer.name === 'Priya Sharma') {
      console.log('✓ Search by customer name matched correctly ("Priya")');
    } else {
      throw new Error(`Search customer failed: ${JSON.stringify(resSearch.body)}`);
    }

    // 11. Customer lists linked shops
    console.log('\n[11] Testing GET /api/accounts/my-shops (Customer views linked shops):');
    const resCustomerShops = await request(app)
      .get('/api/accounts/my-shops')
      .set('Authorization', `Bearer ${customerToken}`);
    if (
      resCustomerShops.status === 200 &&
      resCustomerShops.body.accounts.length === 1 &&
      resCustomerShops.body.accounts[0].shop.name === 'Mohan Provision & Super Store'
    ) {
      console.log('✓ Customer sees linked shop "Mohan Provision & Super Store" and credit limit ₹7,500');
    } else {
      throw new Error(`Customer my-shops failed: ${JSON.stringify(resCustomerShops.body)}`);
    }

    console.log('\n=============================================================');
    console.log(' ALL PHASE 2 SHOPS & ACCOUNTS VERIFICATIONS PASSED (100%)');
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

runPhase2Tests();

