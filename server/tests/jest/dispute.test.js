const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/app');

let mongoServer;
let skToken;
let custToken;
let adminToken;
let accountId;
let entryId;
let disputeId;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  // Shopkeeper
  const resSk = await request(app).post('/api/auth/register').send({
    name: 'Dispute SK',
    email: 'dispute.sk@test.com',
    phone: '9500110011',
    password: 'password123',
    role: 'shopkeeper'
  });
  skToken = resSk.body.token;

  // Customer
  const resCust = await request(app).post('/api/auth/register').send({
    name: 'Dispute Customer',
    email: 'dispute.cust@test.com',
    phone: '9500110022',
    password: 'password123',
    role: 'customer'
  });
  custToken = resCust.body.token;

  // Admin
  const resAdmin = await request(app).post('/api/auth/register').send({
    name: 'Dispute Admin',
    email: 'dispute.admin@test.com',
    phone: '9500110033',
    password: 'password123',
    role: 'admin'
  });
  adminToken = resAdmin.body.token;

  await request(app)
    .post('/api/shops')
    .set('Authorization', `Bearer ${skToken}`)
    .send({ name: 'Dispute Store', phone: '9500110011' });

  const resAcc = await request(app)
    .post('/api/accounts')
    .set('Authorization', `Bearer ${skToken}`)
    .send({ phone: '9500110022', creditLimit: 100000 });
  accountId = resAcc.body.account._id;

  // Create credit entry
  const resEntry = await request(app)
    .post('/api/ledgers')
    .set('Authorization', `Bearer ${skToken}`)
    .send({
      accountId,
      type: 'credit',
      amountPaise: 50000,
      note: 'Grocery bill to dispute'
    });
  entryId = resEntry.body.entry._id;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Dispute Lifecycle & Admin Resolution (Jest + Supertest)', () => {
  it('should allow customer to dispute a pending entry with reason', async () => {
    const res = await request(app)
      .post(`/api/ledgers/${entryId}/dispute`)
      .set('Authorization', `Bearer ${custToken}`)
      .send({ reason: 'Overcharged by ₹200' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.entry.status).toBe('disputed');
    expect(res.body.dispute.status).toBe('open');
    disputeId = res.body.dispute._id;
  });

  it('should allow customer to escalate dispute to admin', async () => {
    const res = await request(app)
      .post(`/api/disputes/${disputeId}/escalate`)
      .set('Authorization', `Bearer ${custToken}`)
      .send({ reason: 'Shopkeeper refused to respond in store' });

    expect(res.status).toBe(200);
    expect(res.body.dispute.status).toBe('escalated');
  });

  it('should list escalated disputes in admin dispute endpoint', async () => {
    const res = await request(app)
      .get('/api/admin/disputes?status=escalated')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.disputes.length).toBeGreaterThanOrEqual(1);
    expect(res.body.disputes[0]._id).toBe(disputeId);
  });

  it('should allow admin to resolve dispute by accepting and auto-reversing entry', async () => {
    const res = await request(app)
      .post(`/api/admin/disputes/${disputeId}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'accept', note: 'Customer billing proof verified by admin' });

    expect(res.status).toBe(200);
    expect(res.body.dispute.status).toBe('resolved');
    expect(res.body.reversingEntry).toBeDefined();
    expect(res.body.reversingEntry.type).toBe('payment');
    expect(res.body.reversingEntry.amountPaise).toBe(50000);

    // Verify balance is ₹0 after reversal
    const resBal = await request(app)
      .get(`/api/ledgers/accounts/${accountId}/balance`)
      .set('Authorization', `Bearer ${skToken}`);
    expect(resBal.body.balance.netBalancePaise).toBe(0);
  });
});

