import { FastifyInstance } from 'fastify';
import { metricsService } from '../services/metrics.service.js';

// In-memory request metrics
let requestCount = 0;
let errorCount = 0;
let totalLatency = 0;
const statusCodes: Record<string, number> = {};
const routeLatencies: Record<string, { count: number; total: number }> = {};

/**
 * Track request metrics (call from onResponse hook)
 */
export function trackRequest(
  route: string,
  method: string,
  statusCode: number,
  latencyMs: number
): void {
  requestCount++;
  totalLatency += latencyMs;

  const statusKey = `${Math.floor(statusCode / 100)}xx`;
  statusCodes[statusKey] = (statusCodes[statusKey] || 0) + 1;

  if (statusCode >= 400) {
    errorCount++;
  }

  const routeKey = `${method} ${route}`;
  if (!routeLatencies[routeKey]) {
    routeLatencies[routeKey] = { count: 0, total: 0 };
  }
  routeLatencies[routeKey].count++;
  routeLatencies[routeKey].total += latencyMs;
}

export default async function metricsRoutes(fastify: FastifyInstance) {
  /**
   * Prometheus metrics endpoint
   * GET /metrics
   */
  fastify.get('/metrics', async (_request, reply) => {
    const lines: string[] = [];

    // Help and type declarations
    lines.push('# HELP http_requests_total Total number of HTTP requests');
    lines.push('# TYPE http_requests_total counter');
    lines.push(`http_requests_total ${requestCount}`);

    lines.push('# HELP http_errors_total Total number of HTTP errors');
    lines.push('# TYPE http_errors_total counter');
    lines.push(`http_errors_total ${errorCount}`);

    lines.push('# HELP http_request_duration_ms_sum Sum of HTTP request latencies');
    lines.push('# TYPE http_request_duration_ms_sum counter');
    lines.push(`http_request_duration_ms_sum ${totalLatency}`);

    if (requestCount > 0) {
      lines.push('# HELP http_request_duration_ms_avg Average HTTP request latency');
      lines.push('# TYPE http_request_duration_ms_avg gauge');
      lines.push(
        `http_request_duration_ms_avg ${(totalLatency / requestCount).toFixed(2)}`
      );
    }

    // Status code breakdown
    lines.push('# HELP http_requests_by_status HTTP requests by status code class');
    lines.push('# TYPE http_requests_by_status counter');
    Object.entries(statusCodes).forEach(([status, count]) => {
      lines.push(`http_requests_by_status{status="${status}"} ${count}`);
    });

    // Route latencies
    lines.push('# HELP http_route_latency_ms_avg Average latency by route');
    lines.push('# TYPE http_route_latency_ms_avg gauge');
    Object.entries(routeLatencies).forEach(([route, data]) => {
      const avgLatency = data.total / data.count;
      const safeRoute = route.replace(/"/g, '\\"');
      lines.push(
        `http_route_latency_ms_avg{route="${safeRoute}"} ${avgLatency.toFixed(2)}`
      );
    });

    // Application metrics (from local storage in dev)
    const appMetrics = metricsService.getLocalMetrics();
    if (Object.keys(appMetrics).length > 0) {
      lines.push('# HELP app_metric Application-level metrics');
      lines.push('# TYPE app_metric gauge');
      Object.entries(appMetrics).forEach(([key, value]) => {
        const [metricName] = key.split(':');
        const safeName = metricName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        lines.push(`app_${safeName} ${value}`);
      });
    }

    reply.header('Content-Type', 'text/plain; charset=utf-8');
    return lines.join('\n');
  });

  /**
   * Health check with detailed status
   * GET /health
   */
  fastify.get('/health', async () => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      metrics: {
        requests: requestCount,
        errors: errorCount,
        avgLatencyMs: requestCount > 0 ? totalLatency / requestCount : 0,
      },
    };
  });
}
