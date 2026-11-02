const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/app');

let mongoServer;
let skToken;
let accountId;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  // Register shopkeeper
  const resSk = await request(app).post('/api/auth/register').send({
    name: 'Balance Shopkeeper',
    email: 'balance.sk@test.com',
    phone: '9700110011',
    password: 'password123',
    role: 'shopkeeper'
  });
  skToken = resSk.body.token;

  // Create shop
  await request(app)
    .post('/api/shops')
    .set('Authorization', `Bearer ${skToken}`)
    .send({
      name: 'Ledger Test Store',
      phone: '9700110011'
    });

  // Create customer account with credit limit ₹500 (50,000 paise)
  const resAcc = await request(app)
    .post('/api/accounts')
    .set('Authorization', `Bearer ${skToken}`)
    .send({
      name: 'Balance Customer',
      email: 'balance.cust@test.com',
      phone: '9700110022',
      creditLimit: 50000
    });
  accountId = resAcc.body.account._id;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Ledger Core & Balance Arithmetic (Jest + Supertest)', () => {
  it('should create credit entry and update balance to ₹300', async () => {
    const res = await request(app)
      .post('/api/ledgers')
      .set('Authorization', `Bearer ${skToken}`)
      .send({
        accountId,
        type: 'credit',
        amountPaise: 30000,
        note: 'First credit'
      });
    expect(res.status).toBe(201);
    expect(res.body.balancePaise).toBe(30000);
    expect(res.body.limitWarning).toBe(false);
  });

  it('should warn when credit exceeds limit but still record entry', async () => {
    // 30000 + 30000 = 60000 > 50000 limit
    const res = await request(app)
      .post('/api/ledgers')
      .set('Authorization', `Bearer ${skToken}`)
      .send({
        accountId,
        type: 'credit',
        amountPaise: 30000,
        note: 'Over limit purchase'
      });
    expect(res.status).toBe(201);
    expect(res.body.limitWarning).toBe(true);
    expect(res.body.balancePaise).toBe(60000);
  });

  it('should decrease balance with payment entry', async () => {
    const res = await request(app)
      .post('/api/ledgers')
      .set('Authorization', `Bearer ${skToken}`)
      .send({
        accountId,
        type: 'payment',
        amountPaise: 20000,
        note: 'Cash payment'
      });
    expect(res.status).toBe(201);
    expect(res.body.balancePaise).toBe(40000); // 60000 - 20000 = 40000
  });

  it('should create an append-only reversal entry and exclude reversed pairs from balance', async () => {
    // Fetch ledger to get the over-limit credit entry
    const resLedger = await request(app)
      .get(`/api/ledgers/accounts/${accountId}`)
      .set('Authorization', `Bearer ${skToken}`);
    const overLimitEntry = resLedger.body.entries.find((e) => e.note === 'Over limit purchase');

    const resReverse = await request(app)
      .post(`/api/ledgers/${overLimitEntry._id}/reverse`)
      .set('Authorization', `Bearer ${skToken}`)
      .send({ note: 'Reversing erroneous credit' });

    expect(resReverse.status).toBe(201);
    expect(resReverse.body.reversalEntry.type).toBe('payment');
    // Original 30,000 credit reversed -> Net balance should be 30,000 - 20,000 = 10,000 paise (₹100)
    expect(resReverse.body.balancePaise).toBe(10000);
  });

  it('should reject reversing an already reversed entry', async () => {
    const resLedger = await request(app)
      .get(`/api/ledgers/accounts/${accountId}`)
      .set('Authorization', `Bearer ${skToken}`);
    const overLimitEntry = resLedger.body.entries.find((e) => e.note === 'Over limit purchase');

    const resDuplicateReverse = await request(app)
      .post(`/api/ledgers/${overLimitEntry._id}/reverse`)
      .set('Authorization', `Bearer ${skToken}`)
      .send();

    expect(resDuplicateReverse.status).toBe(400);
    expect(resDuplicateReverse.body.success).toBe(false);
  });
});
