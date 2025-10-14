#!/usr/bin/env node

/**
 * Log-Trace Correlation Utility
 * Injects OpenTelemetry trace_id into logs for distributed tracing
 */

const { context, trace } = require('@opentelemetry/api');

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
module.exports = {
  getTraceId,
  getSpanId,
  getCorrelationMetadata,
  createTraceAwareLogger,
  getSamplingRules,
  getRetentionPolicy
};

// CLI usage
if (require.main === module) {
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
