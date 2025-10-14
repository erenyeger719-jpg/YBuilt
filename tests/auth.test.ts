import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { initDb, type Database } from '../server/db.js';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

const TEST_DB_FILE = './data/test-auth-db.json';
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

describe('Authentication Endpoints', () => {
  let db: Database;

  before(async () => {
    db = await initDb(TEST_DB_FILE);
    db.data.users = [];
    await db.write();
  });

  const generateUniqueEmail = () => 
    `test-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`;

  after(async () => {
    try {
      if (fs.existsSync(TEST_DB_FILE)) {
        fs.unlinkSync(TEST_DB_FILE);
      }
    } catch (err) {
      console.error('Cleanup error:', err);
    }
  });

  describe('POST /api/auth/register', () => {
    test('Success: Valid email/password creates user and returns token', async () => {
      const testEmail = generateUniqueEmail();
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: 'password123'
        })
      });

      const data = await response.json();
      
      assert.strictEqual(response.status, 201, 'Should return 201 status');
      assert.ok(data.token, 'Should return a token');
      assert.ok(data.user, 'Should return user object');
      assert.strictEqual(data.user.email, testEmail, 'User email should match');
      assert.ok(data.user.id, 'User should have an id');
    });

    test('Error: Invalid email format returns 400', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'invalid-email',
          password: 'password123'
        })
      });

      const data = await response.json();
      
      assert.strictEqual(response.status, 400, 'Should return 400 status');
      assert.ok(data.error, 'Should return error message');
      assert.match(data.error, /invalid email/i, 'Error should mention invalid email');
    });

    test('Error: Password too short (< 6 chars) returns 400', async () => {
      const testEmail = generateUniqueEmail();
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: '12345'
        })
      });

      const data = await response.json();
      
      assert.strictEqual(response.status, 400, 'Should return 400 status');
      assert.ok(data.error, 'Should return error message');
      assert.match(data.error, /at least 6 characters/i, 'Error should mention password length');
    });

    test('Error: Duplicate email returns 409', async () => {
      const testEmail = generateUniqueEmail();
      await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: 'password123'
        })
      });

      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: 'password123'
        })
      });

      const data = await response.json();
      
      assert.strictEqual(response.status, 409, 'Should return 409 status');
      assert.ok(data.error, 'Should return error message');
      assert.match(data.error, /already exists/i, 'Error should mention email already exists');
    });

    test('Verify JWT token payload contains sub (user id) and email', async () => {
      const testEmail = generateUniqueEmail();
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: 'password123'
        })
      });

      const data = await response.json();
      
      assert.ok(data.token, 'Should have token');
      
      const decoded = jwt.verify(data.token, JWT_SECRET) as any;
      
      assert.ok(decoded.sub, 'Token should contain sub (user id)');
      assert.strictEqual(decoded.email, testEmail, 'Token should contain email');
    });
  });

  describe('POST /api/auth/login', () => {
    let loginTestEmail: string;

    before(async () => {
      loginTestEmail = generateUniqueEmail();
      await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginTestEmail,
          password: 'correct-password'
        })
      });
    });

    test('Success: Valid credentials return token', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginTestEmail,
          password: 'correct-password'
        })
      });

      const data = await response.json();
      
      assert.strictEqual(response.status, 200, 'Should return 200 status');
      assert.ok(data.token, 'Should return a token');
      assert.ok(data.user, 'Should return user object');
      assert.strictEqual(data.user.email, loginTestEmail, 'User email should match');
    });

    test('Error: Wrong password returns 401', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginTestEmail,
          password: 'wrong-password'
        })
      });

      const data = await response.json();
      
      assert.strictEqual(response.status, 401, 'Should return 401 status');
      assert.ok(data.error, 'Should return error message');
    });

    test('Error: Non-existent email returns 401', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent@example.com',
          password: 'some-password'
        })
      });

      const data = await response.json();
      
      assert.strictEqual(response.status, 401, 'Should return 401 status');
      assert.ok(data.error, 'Should return error message');
    });

    test('Verify returned token is valid and has correct payload', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginTestEmail,
          password: 'correct-password'
        })
      });

      const data = await response.json();
      
      assert.ok(data.token, 'Should have token');
      
      const decoded = jwt.verify(data.token, JWT_SECRET) as any;
      
      assert.ok(decoded.sub, 'Token should contain sub (user id)');
      assert.strictEqual(decoded.email, loginTestEmail, 'Token should contain correct email');
      assert.ok(decoded.exp, 'Token should have expiration');
    });
  });
});
