const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/app');
const User = require('../../src/models/User');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Auth & RBAC Flow (Jest + Supertest)', () => {
  it('should register shopkeeper, customer, and admin successfully', async () => {
    const resSk = await request(app).post('/api/auth/register').send({
      name: 'Test Shopkeeper',
      email: 'sk@test.com',
      phone: '9900110011',
      password: 'password123',
      role: 'shopkeeper'
    });
    expect(resSk.status).toBe(201);
    expect(resSk.body.token).toBeDefined();
    expect(resSk.body.user.role).toBe('shopkeeper');

    const resCust = await request(app).post('/api/auth/register').send({
      name: 'Test Customer',
      email: 'cust@test.com',
      phone: '9900110022',
      password: 'password123',
      role: 'customer'
    });
    expect(resCust.status).toBe(201);
    expect(resCust.body.user.role).toBe('customer');

    const resAdmin = await request(app).post('/api/auth/register').send({
      name: 'Test Admin',
      email: 'admin@test.com',
      phone: '9900110033',
      password: 'password123',
      role: 'admin'
    });
    expect(resAdmin.status).toBe(201);
    expect(resAdmin.body.user.role).toBe('admin');
  });

  it('should reject registration with duplicate email or phone', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Duplicate Guy',
      email: 'sk@test.com',
      phone: '9900119999',
      password: 'password123',
      role: 'shopkeeper'
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should authenticate user and return token on valid login', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'sk@test.com',
      password: 'password123'
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('sk@test.com');
  });

  it('should reject invalid password with 401', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'sk@test.com',
      password: 'wrongpassword'
    });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should enforce RBAC with requireRole middleware', async () => {
    const loginCust = await request(app).post('/api/auth/login').send({
      email: 'cust@test.com',
      password: 'password123'
    });
    const custToken = loginCust.body.token;

    // Customer forbidden on shopkeeper-only route
    const resForbidden = await request(app)
      .get('/api/auth/role/shopkeeper')
      .set('Authorization', `Bearer ${custToken}`);
    expect(resForbidden.status).toBe(403);

    // Customer permitted on customer route
    const resAllowed = await request(app)
      .get('/api/auth/role/customer')
      .set('Authorization', `Bearer ${custToken}`);
    expect(resAllowed.status).toBe(200);
  });

  it('should prevent deactivated users from logging in', async () => {
    await User.updateOne({ email: 'cust@test.com' }, { $set: { isActive: false } });

    const res = await request(app).post('/api/auth/login').send({
      email: 'cust@test.com',
      password: 'password123'
    });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/deactivated/i);

    // Re-activate
    await User.updateOne({ email: 'cust@test.com' }, { $set: { isActive: true } });
  });
});

