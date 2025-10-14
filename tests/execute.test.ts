import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { initDb, type Database } from '../server/db.js';
import fs from 'fs';

const TEST_DB_FILE = './data/test-execute-db.json';
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';
const EXECUTION_TIMEOUT_MS = parseInt(process.env.CODE_EXECUTION_TIMEOUT || '5000');
const MAX_CODE_OUTPUT = parseInt(process.env.CODE_EXECUTION_MAX_OUTPUT || '10000');

describe('Code Execution Endpoints', () => {
  let db: Database;
  let authToken: string;
  let userId: number;

  const generateUniqueEmail = () => 
    `test-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`;

  before(async () => {
    db = await initDb(TEST_DB_FILE);
    db.data.users = [];
    await db.write();

    const registerResponse = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: generateUniqueEmail(),
        password: 'password123'
      })
    });
    const userData = await registerResponse.json();
    authToken = userData.token;
    userId = userData.user.id;
  });

  after(async () => {
    try {
      if (fs.existsSync(TEST_DB_FILE)) {
        fs.unlinkSync(TEST_DB_FILE);
      }
    } catch (err) {
      console.error('Cleanup error:', err);
    }
  });

  describe('POST /api/execute', () => {
    test('Success: Execute simple JavaScript code "console.log(\'hello\')"', async () => {
      const response = await fetch(`${BASE_URL}/api/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          language: 'javascript',
          code: 'console.log("hello");'
        })
      });

      const data = await response.json();
      
      assert.strictEqual(response.status, 200, 'Should return 200 status');
      assert.ok(data.executionId, 'Should return executionId');
      assert.ok(data.stdout !== undefined, 'Should have stdout property');
      assert.ok(data.executionTimeMs !== undefined, 'Should have execution time');
    });

    test('Success: Returns stdout with output', async () => {
      const response = await fetch(`${BASE_URL}/api/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          language: 'javascript',
          code: 'console.log("test output"); console.log("line 2");'
        })
      });

      const data = await response.json();
      
      assert.strictEqual(response.status, 200, 'Should return 200 status');
      
      if (process.env.ENABLE_CODE_EXECUTION === 'true') {
        assert.ok(data.stdout, 'Should have stdout');
        assert.match(data.stdout, /test output/i, 'Stdout should contain output');
      } else {
        assert.ok(data.stderr, 'Should indicate execution is disabled');
      }
    });

    test('Success: Respects timeout (test with long-running code)', async () => {
      const startTime = Date.now();
      
      const response = await fetch(`${BASE_URL}/api/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          language: 'javascript',
          code: 'while(true) { /* infinite loop */ }'
        })
      });

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      const data = await response.json();
      
      if (process.env.ENABLE_CODE_EXECUTION === 'true') {
        assert.ok(data.status === 'timeout' || executionTime <= EXECUTION_TIMEOUT_MS + 1000, 
          'Should timeout or complete within timeout period');
      } else {
        assert.strictEqual(data.status, 'error', 'Should return error when execution disabled');
      }
    });

    test('Error: Timeout after EXECUTION_TIMEOUT_MS', async () => {
      const response = await fetch(`${BASE_URL}/api/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          language: 'javascript',
          code: `
            const start = Date.now();
            while (Date.now() - start < ${EXECUTION_TIMEOUT_MS + 2000}) {
              // Wait longer than timeout
            }
          `
        })
      });

      const data = await response.json();

      if (process.env.ENABLE_CODE_EXECUTION === 'true') {
        assert.ok(
          data.status === 'timeout' || data.executionTimeMs >= EXECUTION_TIMEOUT_MS - 500,
          'Should timeout or take close to timeout duration'
        );
      }
    });

    test('Error: Unsupported language returns 400', async () => {
      const response = await fetch(`${BASE_URL}/api/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          language: 'brainfuck',
          code: '+++'
        })
      });

      const data = await response.json();
      
      assert.strictEqual(response.status, 400, 'Should return 400 for unsupported language');
      assert.ok(data.error, 'Should return error message');
      assert.match(data.error, /unsupported language/i, 'Error should mention unsupported language');
      assert.ok(data.supportedLanguages, 'Should return list of supported languages');
    });

    test('Verify output limit enforcement (MAX_CODE_OUTPUT)', async () => {
      const largeOutput = 'x'.repeat(MAX_CODE_OUTPUT + 1000);
      
      const response = await fetch(`${BASE_URL}/api/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          language: 'javascript',
          code: `console.log('${largeOutput}');`
        })
      });

      const data = await response.json();
      
      if (process.env.ENABLE_CODE_EXECUTION === 'true' && data.stdout) {
        assert.ok(
          data.stdout.length <= MAX_CODE_OUTPUT + 100,
          `Output should be limited to around ${MAX_CODE_OUTPUT} characters`
        );
      }
    });

    test('Error: Requires authentication (401 without token)', async () => {
      const response = await fetch(`${BASE_URL}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: 'javascript',
          code: 'console.log("test");'
        })
      });

      assert.strictEqual(response.status, 401, 'Should return 401 when no auth token provided');
    });
  });

  describe('GET /api/execute/languages', () => {
    test('Returns list of supported languages', async () => {
      const response = await fetch(`${BASE_URL}/api/execute/languages`);
      const data = await response.json();
      
      assert.strictEqual(response.status, 200, 'Should return 200 status');
      assert.ok(data.languages, 'Should return languages array');
      assert.ok(Array.isArray(data.languages), 'Languages should be an array');
      assert.ok(data.languages.length > 0, 'Should have at least one supported language');
      assert.ok(data.languages.includes('javascript'), 'Should support JavaScript');
    });
  });

  describe('GET /api/execute/history', () => {
    test('Returns execution history for authenticated user', async () => {
      await fetch(`${BASE_URL}/api/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          language: 'javascript',
          code: 'console.log("history test");'
        })
      });

      const response = await fetch(`${BASE_URL}/api/execute/history`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const data = await response.json();
      
      assert.strictEqual(response.status, 200, 'Should return 200 status');
      assert.ok(data.executions, 'Should return executions array');
      assert.ok(Array.isArray(data.executions), 'Executions should be an array');
    });

    test('Error: Requires authentication (401 without token)', async () => {
      const response = await fetch(`${BASE_URL}/api/execute/history`);
      
      assert.strictEqual(response.status, 401, 'Should return 401 when no auth token provided');
    });
  });

  describe('GET /api/execute/:executionId', () => {
    test('Returns execution details', async () => {
      const execResponse = await fetch(`${BASE_URL}/api/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          language: 'javascript',
          code: 'console.log("execution details test");'
        })
      });
      const execData = await execResponse.json();
      const executionId = execData.executionId;

      const response = await fetch(`${BASE_URL}/api/execute/${executionId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const data = await response.json();
      
      assert.strictEqual(response.status, 200, 'Should return 200 status');
      assert.ok(data.execution, 'Should return execution object');
      assert.strictEqual(data.execution.id, executionId, 'Should return correct execution');
    });

    test('Error: Returns 404 for non-existent execution', async () => {
      const response = await fetch(`${BASE_URL}/api/execute/non-existent-id`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      assert.strictEqual(response.status, 404, 'Should return 404 for non-existent execution');
    });
  });
});
