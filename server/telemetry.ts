import client from 'prom-client';
import type { Request, Response } from 'express';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method','route','status'],
  registers: [register]
});

export const jobDurationHistogram = new client.Histogram({
  name: 'job_duration_seconds',
  help: 'Job processing duration in seconds',
  labelNames: ['status'],
  registers: [register]
});

export const jobQueueDepthGauge = new client.Gauge({
  name: 'job_queue_depth',
  help: 'Current depth of job queue',
  registers: [register]
});

export const atomicWriteFailuresCounter = new client.Counter({
  name: 'atomic_write_failures_total',
  help: 'Total number of atomic write failures',
  registers: [register]
});

export function metricsHandler(req: Request, res: Response) {
  res.set('Content-Type', register.contentType);
  register.metrics().then(metrics => res.send(metrics)).catch(err => {
    res.status(500).send('# metrics error');
  });
}
