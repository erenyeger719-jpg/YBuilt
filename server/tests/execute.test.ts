import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import executeRoutes from '../routes/execute.js';

const app = express();
app.use(express.json());
app.use('/api/execute', executeRoutes);

describe('Execute API', () => {
  it('should execute simple JavaScript', async () => {
    const res = await request(app)
      .post('/api/execute')
      .send({
        code: 'console.log("Hello, World!");',
      })
      .expect(200);

    expect(res.body.stdout).toContain('Hello, World!');
    expect(res.body.status).toBe('completed');
  });

  it('should capture console.log output', async () => {
    const res = await request(app)
      .post('/api/execute')
      .send({
        code: 'console.log(1 + 1); console.log("test");',
      })
      .expect(200);

    expect(res.body.stdout).toContain('2');
    expect(res.body.stdout).toContain('test');
  });

  it('should timeout on infinite loop', async () => {
    const res = await request(app)
      .post('/api/execute')
      .send({
        code: 'while(true) {}',
      })
      .expect(200);

    expect(res.body.status).toBe('timeout');
    expect(res.body.error).toContain('timed out');
  }, 10000); // Increase timeout for this test

  it('should capture errors', async () => {
    const res = await request(app)
      .post('/api/execute')
      .send({
        code: 'throw new Error("Test error");',
      })
      .expect(200);

    expect(res.body.status).toBe('error');
    expect(res.body.error || res.body.stderr).toContain('error');
  });

  it('should handle JSON output', async () => {
    const res = await request(app)
      .post('/api/execute')
      .send({
        code: 'console.log({ foo: "bar", num: 42 });',
      })
      .expect(200);

    expect(res.body.stdout).toContain('foo');
    expect(res.body.stdout).toContain('bar');
  });

  it('should truncate large output', async () => {
    const largeOutput = 'x'.repeat(100000);
    const res = await request(app)
      .post('/api/execute')
      .send({
        code: `console.log("${largeOutput}");`,
      })
      .expect(200);

    expect(res.body.stdout.length).toBeLessThanOrEqual(65536 + 100); // MAX_BYTES + buffer
    expect(res.body.stdout).toContain('TRUNCATED');
  });

  it('should reject code that is too long', async () => {
    const longCode = 'console.log("test");'.repeat(5000);
    await request(app)
      .post('/api/execute')
      .send({
        code: longCode,
      })
      .expect(400);
  });
});
