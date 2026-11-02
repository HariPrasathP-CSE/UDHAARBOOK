const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/app');
const { calculateAccountAgeing } = require('../../src/utils/ageingHelper');

let mongoServer;
let skToken;
let accountId;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  const resSk = await request(app).post('/api/auth/register').send({
    name: 'Ageing Shopkeeper',
    email: 'ageing.sk@test.com',
    phone: '9600110011',
    password: 'password123',
    role: 'shopkeeper'
  });
  skToken = resSk.body.token;

  await request(app)
    .post('/api/shops')
    .set('Authorization', `Bearer ${skToken}`)
    .send({ name: 'Ageing Mart', phone: '9600110011' });

  const resAcc = await request(app)
    .post('/api/accounts')
    .set('Authorization', `Bearer ${skToken}`)
    .send({
      name: 'Ageing Customer',
      email: 'ageing.cust@test.com',
      phone: '9600110022',
      creditLimit: 500000
    });
  accountId = resAcc.body.account._id;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('FIFO Ageing Allocation & Aggregations (Jest + Supertest)', () => {
  it('should correctly segment dues into 0-7, 8-30, and 30+ day buckets via FIFO', async () => {
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    // 1. Credit 45 days ago: ₹100 (10,000 paise)
    await request(app).post('/api/ledgers').set('Authorization', `Bearer ${skToken}`).send({
      accountId,
      type: 'credit',
      amountPaise: 10000,
      entryDate: new Date(now - 45 * DAY_MS)
    });

    // 2. Credit 15 days ago: ₹200 (20,000 paise)
    await request(app).post('/api/ledgers').set('Authorization', `Bearer ${skToken}`).send({
      accountId,
      type: 'credit',
      amountPaise: 20000,
      entryDate: new Date(now - 15 * DAY_MS)
    });

    // 3. Credit 3 days ago: ₹300 (30,000 paise)
    await request(app).post('/api/ledgers').set('Authorization', `Bearer ${skToken}`).send({
      accountId,
      type: 'credit',
      amountPaise: 30000,
      entryDate: new Date(now - 3 * DAY_MS)
    });

    // 4. Payment of ₹150 (15,000 paise) made today.
    // Under FIFO:
    // Retires entire oldest 45-day debt of ₹100 (10,000 paise).
    // Retires ₹50 (5,000 paise) of 15-day debt.
    // Remaining unpaid:
    // 30+ days: ₹0 (0 paise)
    // 8-30 days: ₹150 (15,000 paise)
    // 0-7 days: ₹300 (30,000 paise)
    // Total net outstanding: ₹450 (45,000 paise)
    await request(app).post('/api/ledgers').set('Authorization', `Bearer ${skToken}`).send({
      accountId,
      type: 'payment',
      amountPaise: 15000,
      entryDate: new Date(now)
    });

    const ageing = await calculateAccountAgeing(accountId);

    expect(ageing.netBalancePaise).toBe(45000);
    expect(ageing.days30PlusPaise).toBe(0);
    expect(ageing.days8_30Paise).toBe(15000);
    expect(ageing.days0_7Paise).toBe(30000);
  });

  it('should return valid shopkeeper dashboard metrics matching ageing', async () => {
    const res = await request(app)
      .get('/api/dashboard/shopkeeper')
      .set('Authorization', `Bearer ${skToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.totalOutstandingPaise).toBe(45000);
    expect(res.body.ageingTotals.days0_7Paise).toBe(30000);
    expect(res.body.ageingTotals.days8_30Paise).toBe(15000);
    expect(res.body.ageingTotals.days30PlusPaise).toBe(0);
  });
});
