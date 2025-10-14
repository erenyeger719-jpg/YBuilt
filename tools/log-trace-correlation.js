#!/usr/bin/env node

/**
 * Log-Trace Correlation Utility
 * Injects OpenTelemetry trace_id into logs for distributed tracing
 */

import { context, trace } from '@opentelemetry/api';

/**
 * Extract trace ID from current OpenTelemetry context
 * @returns {string} trace_id or 'no-trace' if not in a trace
 */
function getTraceId() {
  const span = trace.getSpan(context.active());
  if (!span) {
    return 'no-trace';
  }
  
  const spanContext = span.spanContext();
  return spanContext.traceId || 'invalid-trace';
}

/**
 * Extract span ID from current OpenTelemetry context
 * @returns {string} span_id or 'no-span' if not in a trace
 */
function getSpanId() {
  const span = trace.getSpan(context.active());
  if (!span) {
    return 'no-span';
  }
  
  const spanContext = span.spanContext();
  return spanContext.spanId || 'invalid-span';
}

/**
 * Create a correlation object with trace/span IDs
 * @returns {Object} Correlation metadata
 */
function getCorrelationMetadata() {
  return {
    trace_id: getTraceId(),
    span_id: getSpanId(),
    timestamp: new Date().toISOString()
  };
}

/**
 * Create a logger with trace correlation
 * @param {string} service - Service name
 * @returns {Object} Logger with trace-aware methods
 */
function createTraceAwareLogger(service = 'ybuilt') {
  const baseLog = (level, message, meta = {}) => {
    const correlation = getCorrelationMetadata();
    const logEntry = {
      level,
      service,
      message,
      ...correlation,
      ...meta
    };
    
    console.log(JSON.stringify(logEntry));
  };
  
  return {
    debug: (msg, meta) => baseLog('debug', msg, meta),
    info: (msg, meta) => baseLog('info', msg, meta),
    warn: (msg, meta) => baseLog('warn', msg, meta),
    error: (msg, meta) => baseLog('error', msg, meta),
    
    // Express middleware to inject trace into req
    middleware: () => {
      return (req, res, next) => {
        req.trace_id = getTraceId();
        req.span_id = getSpanId();
        
        // Add trace headers to response
        res.setHeader('X-Trace-Id', req.trace_id);
        res.setHeader('X-Span-Id', req.span_id);
        
        next();
      };
    }
  };
}

/**
 * Sampling configuration for traces
 * @param {string} environment - Current environment
 * @returns {Object} Sampling rules
 */
function getSamplingRules(environment = process.env.NODE_ENV) {
  const rules = {
    production: {
      defaultSampleRate: 0.1,    // 10% sampling
      errorSampleRate: 1.0,       // 100% sampling for errors
      slowRequestThreshold: 1000, // ms
      slowRequestSampleRate: 0.5  // 50% sampling for slow requests
    },
    
    staging: {
      defaultSampleRate: 0.5,
      errorSampleRate: 1.0,
      slowRequestThreshold: 500,
      slowRequestSampleRate: 1.0
    },
    
    development: {
      defaultSampleRate: 1.0,     // 100% sampling in dev
      errorSampleRate: 1.0,
      slowRequestThreshold: 200,
      slowRequestSampleRate: 1.0
    }
  };
  
  return rules[environment] || rules.development;
}

/**
 * Retention policy for logs and traces
 * @returns {Object} Retention rules
 */
function getRetentionPolicy() {
  return {
    logs: {
      hot: '7d',      // Loki: 7 days in hot storage
      warm: '30d',    // S3: 30 days in warm storage
      cold: '90d'     // Glacier: 90 days in cold storage
    },
    
    traces: {
      hot: '3d',      // Tempo: 3 days in hot storage
      warm: '14d',    // S3: 14 days in warm storage
      archive: '30d'  // Archive for compliance
    },
    
    metrics: {
      raw: '15d',          // Prometheus: 15 days raw metrics
      downsampled_1h: '90d' // 1h downsampled for 90 days
    }
  };
}

// Export functions
export {
  getTraceId,
  getSpanId,
  getCorrelationMetadata,
  createTraceAwareLogger,
  getSamplingRules,
  getRetentionPolicy
};

// SERVER EXAMPLE: Express app with trace correlation
/*
const express = require('express');
const { createTraceAwareLogger } = require('./tools/log-trace-correlation');

const app = express();
const logger = createTraceAwareLogger('ybuilt-api');

// Apply trace middleware globally
app.use(logger.middleware());

app.get('/api/users/:id', async (req, res) => {
  logger.info('Fetching user', { user_id: req.params.id, trace_id: req.trace_id });
  
  try {
    const user = await db.getUser(req.params.id);
    logger.info('User fetched successfully', { user_id: req.params.id, trace_id: req.trace_id });
    res.json(user);
  } catch (error) {
    logger.error('Failed to fetch user', { 
      user_id: req.params.id, 
      trace_id: req.trace_id, 
      error: error.message 
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(5000, () => {
  logger.info('Server started', { port: 5000 });
});
*/

// BROWSER EXAMPLE: Fetch with trace propagation (commented)
/*
// Client-side trace propagation (browser)
async function fetchWithTrace(url, options = {}) {
  // Extract trace ID from response headers if available
  const traceId = sessionStorage.getItem('trace_id') || 'browser-' + Math.random().toString(36).substr(2, 16);
  
  const headers = {
    ...options.headers,
    'X-Trace-Id': traceId,
    'X-Client-Version': '1.0.0'
  };
  
  const response = await fetch(url, { ...options, headers });
  
  // Store trace ID from server response
  const serverTraceId = response.headers.get('X-Trace-Id');
  if (serverTraceId) {
    sessionStorage.setItem('trace_id', serverTraceId);
    console.log('🔍 Trace ID:', serverTraceId);
  }
  
  return response;
}

// Usage in React/frontend
async function loadUserData(userId) {
  try {
    const response = await fetchWithTrace(`/api/users/${userId}`);
    const data = await response.json();
    console.log('✅ User loaded with trace:', sessionStorage.getItem('trace_id'));
    return data;
  } catch (error) {
    console.error('❌ Failed to load user:', {
      trace_id: sessionStorage.getItem('trace_id'),
      error: error.message
    });
    throw error;
  }
}
*/

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const logger = createTraceAwareLogger('ybuilt-cli');
  
  logger.info('Log-trace correlation example', {
    user_id: 'demo-user',
    action: 'test-correlation'
  });
  
  console.log('\n📋 Sampling Rules:');
  console.log(JSON.stringify(getSamplingRules(), null, 2));
  
  console.log('\n📋 Retention Policy:');
  console.log(JSON.stringify(getRetentionPolicy(), null, 2));
}
