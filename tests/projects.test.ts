import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { initDb, type Database } from '../server/db.js';
import fs from 'fs';

const TEST_DB_FILE = './data/test-projects-db.json';
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';

describe('Project CRUD Endpoints', () => {
  let db: Database;
  let authToken: string;
  let userId: number;
  let otherUserToken: string;
  let otherUserId: number;
  let projectId: string;

  before(async () => {
    db = await initDb(TEST_DB_FILE);
    db.data.users = [];
    db.data.projects = [];
    await db.write();

    const registerResponse = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'project-owner@example.com',
        password: 'password123'
      })
    });
    const userData = await registerResponse.json();
    authToken = userData.token;
    userId = userData.user.id;

    const otherRegisterResponse = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'other-user@example.com',
        password: 'password123'
      })
    });
    const otherUserData = await otherRegisterResponse.json();
    otherUserToken = otherUserData.token;
    otherUserId = otherUserData.user.id;
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

  describe('POST /api/jobs (Create Project)', () => {
    test('Success: Creates project with authenticated user', async () => {
      const response = await fetch(`${BASE_URL}/api/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          prompt: 'Create a test project',
          userId: String(userId)
        })
      });

      const data = await response.json();
      
      assert.strictEqual(response.status, 200, 'Should return 200 status');
      assert.ok(data.jobId, 'Should return jobId');
      assert.ok(data.status, 'Should return status');
      
      projectId = data.jobId;
    });

    test('Error: Requires authentication (401 without token)', async () => {
      const response = await fetch(`${BASE_URL}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Create a test project'
        })
      });

      assert.strictEqual(response.status, 401, 'Should return 401 when no auth token provided');
    });
  });

  describe('GET /api/projects/user/:userId (Get User Projects)', () => {
    test('Returns user\'s projects when authenticated', async () => {
      const response = await fetch(`${BASE_URL}/api/projects/user/${userId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const data = await response.json();
      
      assert.strictEqual(response.status, 200, 'Should return 200 status');
      assert.ok(data.projects, 'Should return projects array');
      assert.ok(Array.isArray(data.projects), 'Projects should be an array');
    });

    test('Error: Cannot access other user\'s projects (403)', async () => {
      const response = await fetch(`${BASE_URL}/api/projects/user/${otherUserId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      assert.strictEqual(response.status, 403, 'Should return 403 when trying to access another user\'s projects');
    });
  });

  describe('GET /api/jobs/:id (Get Specific Project)', () => {
    test('Returns specific project', async () => {
      const createResponse = await fetch(`${BASE_URL}/api/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          prompt: 'Another test project',
          userId: String(userId)
        })
      });
      const createData = await createResponse.json();
      const newProjectId = createData.jobId;

      const response = await fetch(`${BASE_URL}/api/jobs/${newProjectId}`);
      const data = await response.json();
      
      assert.strictEqual(response.status, 200, 'Should return 200 status');
      assert.strictEqual(data.id, newProjectId, 'Should return correct project');
      assert.ok(data.prompt, 'Should have prompt');
      assert.ok(data.status, 'Should have status');
    });

    test('Error: Returns 404 for non-existent project', async () => {
      const response = await fetch(`${BASE_URL}/api/jobs/non-existent-id`);
      
      assert.strictEqual(response.status, 404, 'Should return 404 for non-existent project');
    });
  });

  describe('Collaborator Management', () => {
    let collabProjectId: string;

    before(async () => {
      const response = await fetch(`${BASE_URL}/api/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          prompt: 'Collaboration test project',
          userId: String(userId)
        })
      });
      const data = await response.json();
      collabProjectId = data.jobId;
    });

    test('POST /api/projects/:projectId/collaborators - Owner can add collaborator', async () => {
      const response = await fetch(`${BASE_URL}/api/projects/${collabProjectId}/collaborators`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          userId: String(otherUserId),
          role: 'editor'
        })
      });

      const data = await response.json();
      
      assert.strictEqual(response.status, 201, 'Should return 201 status');
      assert.ok(data.collaborator, 'Should return collaborator object');
      assert.strictEqual(data.collaborator.role, 'editor', 'Role should be editor');
    });

    test('GET /api/projects/:projectId/collaborators - Returns collaborators', async () => {
      const response = await fetch(`${BASE_URL}/api/projects/${collabProjectId}/collaborators`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const data = await response.json();
      
      assert.strictEqual(response.status, 200, 'Should return 200 status');
      assert.ok(data.collaborators, 'Should return collaborators array');
      assert.ok(Array.isArray(data.collaborators), 'Collaborators should be an array');
    });

    test('DELETE /api/projects/:projectId/collaborators/:userId - Owner can remove collaborator', async () => {
      const response = await fetch(`${BASE_URL}/api/projects/${collabProjectId}/collaborators/${otherUserId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      assert.strictEqual(response.status, 200, 'Should return 200 status');
    });

    test('Error: Non-owner cannot add collaborator (403)', async () => {
      const response = await fetch(`${BASE_URL}/api/projects/${collabProjectId}/collaborators`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${otherUserToken}`
        },
        body: JSON.stringify({
          userId: '999',
          role: 'viewer'
        })
      });

      assert.strictEqual(response.status, 403, 'Should return 403 when non-owner tries to add collaborator');
    });

    test('Error: Non-owner cannot remove collaborator (403)', async () => {
      const response = await fetch(`${BASE_URL}/api/projects/${collabProjectId}/collaborators/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${otherUserToken}`
        }
      });

      assert.strictEqual(response.status, 403, 'Should return 403 when non-owner tries to remove collaborator');
    });
  });

  describe('Version Control (Commits)', () => {
    let commitProjectId: string;

    before(async () => {
      const response = await fetch(`${BASE_URL}/api/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          prompt: 'Version control test project',
          userId: String(userId)
        })
      });
      const data = await response.json();
      commitProjectId = data.jobId;
    });

    test('POST /api/projects/:projectId/commits - Owner can create commit', async () => {
      const response = await fetch(`${BASE_URL}/api/projects/${commitProjectId}/commits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          message: 'Initial commit',
          changes: {
            files: ['index.html', 'styles.css'],
            diff: { added: 2, modified: 0, deleted: 0 }
          }
        })
      });

      const data = await response.json();
      
      assert.strictEqual(response.status, 201, 'Should return 201 status');
      assert.ok(data.commit, 'Should return commit object');
      assert.strictEqual(data.commit.message, 'Initial commit', 'Commit message should match');
    });

    test('GET /api/projects/:projectId/commits - Returns commit history', async () => {
      const response = await fetch(`${BASE_URL}/api/projects/${commitProjectId}/commits`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const data = await response.json();
      
      assert.strictEqual(response.status, 200, 'Should return 200 status');
      assert.ok(data.commits, 'Should return commits array');
      assert.ok(Array.isArray(data.commits), 'Commits should be an array');
    });
  });
});
