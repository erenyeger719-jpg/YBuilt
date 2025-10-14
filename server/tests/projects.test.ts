import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRoutes from '../routes/auth.js';
import projectsRoutes from '../routes/projects.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectsRoutes);

describe('Projects API', () => {
  let authToken: string;
  let otherUserToken: string;
  let projectId: number;

  beforeAll(async () => {
    // Register and login first user
    const user1 = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'projectuser1@example.com',
        password: 'password123',
      });
    authToken = user1.body.token;

    // Register and login second user
    const user2 = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'projectuser2@example.com',
        password: 'password123',
      });
    otherUserToken = user2.body.token;
  });

  it('should create a new project', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Project',
        content: '# Hello World',
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Test Project');
    expect(res.body.content).toBe('# Hello World');
    projectId = res.body.id;
  });

  it('should get all user projects', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.projects).toBeInstanceOf(Array);
    expect(res.body.projects.length).toBeGreaterThan(0);
  });

  it('should get a specific project', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.id).toBe(projectId);
    expect(res.body.name).toBe('Test Project');
  });

  it('should update a project', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Updated Project',
        content: '# Updated Content',
      })
      .expect(200);

    expect(res.body.name).toBe('Updated Project');
    expect(res.body.content).toBe('# Updated Content');
  });

  it('should reject access to other user project', async () => {
    await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${otherUserToken}`)
      .expect(403);
  });

  it('should delete a project', async () => {
    await request(app)
      .delete(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(204);

    // Verify deleted
    await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(404);
  });

  it('should reject unauthenticated requests', async () => {
    await request(app)
      .post('/api/projects')
      .send({ name: 'Test', content: '' })
      .expect(401);
  });
});
