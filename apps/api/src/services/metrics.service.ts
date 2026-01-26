import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const NAMESPACE = 'PokemonMarketplace';
const isProduction = process.env.NODE_ENV === 'production';

// CloudWatch client (only used in production)
const cloudwatch = isProduction
  ? new CloudWatchClient({ region: process.env.AWS_REGION || 'us-east-1' })
  : null;

// In-memory metrics for local development
const localMetrics: Record<string, number> = {};

interface MetricOptions {
  dimensions?: Record<string, string>;
  unit?: 'Count' | 'Seconds' | 'Milliseconds' | 'Bytes' | 'None';
}

/**
 * Service for tracking application metrics
 */
export class MetricsService {
  private environment: string;

  constructor() {
    this.environment = process.env.ENVIRONMENT || 'dev';
  }

  /**
   * Send a metric to CloudWatch (production) or log locally (development)
   */
  async putMetric(
    metricName: string,
    value: number,
    options: MetricOptions = {}
  ): Promise<void> {
    const { dimensions = {}, unit = 'Count' } = options;

    // Add environment dimension
    const allDimensions = {
      Environment: this.environment,
      ...dimensions,
    };

    if (isProduction && cloudwatch) {
      try {
        await cloudwatch.send(
          new PutMetricDataCommand({
            Namespace: NAMESPACE,
            MetricData: [
              {
                MetricName: metricName,
                Value: value,
                Unit: unit,
                Timestamp: new Date(),
                Dimensions: Object.entries(allDimensions).map(([Name, Value]) => ({
                  Name,
                  Value,
                })),
              },
            ],
          })
        );
      } catch (error) {
        console.error('Failed to send metric to CloudWatch:', error);
      }
    } else {
      // Local development - store in memory
      const key = `${metricName}:${JSON.stringify(allDimensions)}`;
      localMetrics[key] = (localMetrics[key] || 0) + value;
      console.info(`[Metric] ${metricName}: ${value}`, allDimensions);
    }
  }

  // ============================================
  // User Metrics
  // ============================================

  async trackUserRegistration(): Promise<void> {
    await this.putMetric('UserRegistrations', 1);
  }

  async trackUserLogin(): Promise<void> {
    await this.putMetric('UserLogins', 1);
  }

  async trackDailyRewardClaimed(streakDays: number): Promise<void> {
    await this.putMetric('DailyRewardsClaimed', 1);
    await this.putMetric('StreakDays', streakDays, {
      unit: 'Count',
    });
  }

  // ============================================
  // Shop Metrics
  // ============================================

  async trackShopPurchase(itemType: string, price: number): Promise<void> {
    await this.putMetric('ShopPurchases', 1, {
      dimensions: { ItemType: itemType },
    });
    await this.putMetric('CoinsSpent', price, {
      dimensions: { Source: 'shop' },
    });
  }

  async trackEggHatch(rarity: string): Promise<void> {
    await this.putMetric('EggHatches', 1, {
      dimensions: { Rarity: rarity },
    });
  }

  // ============================================
  // Pokemon Metrics
  // ============================================

  async trackPokemonObtained(rarity: string, method: string): Promise<void> {
    await this.putMetric('PokemonObtained', 1, {
      dimensions: { Rarity: rarity, Method: method },
    });
  }

  async trackShinyObtained(): Promise<void> {
    await this.putMetric('ShinyPokemonObtained', 1);
  }

  // ============================================
  // Trade Metrics
  // ============================================

  async trackTradeCreated(): Promise<void> {
    await this.putMetric('TradesCreated', 1);
  }

  async trackTradeCompleted(coinsExchanged: number): Promise<void> {
    await this.putMetric('TradesCompleted', 1);
    if (coinsExchanged > 0) {
      await this.putMetric('CoinsTraded', coinsExchanged);
    }
  }

  async trackTradeCancelled(): Promise<void> {
    await this.putMetric('TradesCancelled', 1);
  }

  async trackTradeRejected(): Promise<void> {
    await this.putMetric('TradesRejected', 1);
  }

  // ============================================
  // API Metrics
  // ============================================

  async trackApiLatency(
    route: string,
    method: string,
    durationMs: number
  ): Promise<void> {
    await this.putMetric('ApiLatency', durationMs, {
      dimensions: { Route: route, Method: method },
      unit: 'Milliseconds',
    });
  }

  async trackApiError(
    route: string,
    statusCode: number,
    errorType: string
  ): Promise<void> {
    await this.putMetric('ApiErrors', 1, {
      dimensions: {
        Route: route,
        StatusCode: statusCode.toString(),
        ErrorType: errorType,
      },
    });
  }

  // ============================================
  // Coin Economy Metrics
  // ============================================

  async trackCoinsEarned(amount: number, source: string): Promise<void> {
    await this.putMetric('CoinsEarned', amount, {
      dimensions: { Source: source },
    });
  }

  async trackCoinsSpent(amount: number, destination: string): Promise<void> {
    await this.putMetric('CoinsSpent', amount, {
      dimensions: { Destination: destination },
    });
  }

  // ============================================
  // Local Development Helpers
  // ============================================

  /**
   * Get all metrics (for local development/debugging)
   */
  getLocalMetrics(): Record<string, number> {
    return { ...localMetrics };
  }

  /**
   * Reset local metrics (for testing)
   */
  resetLocalMetrics(): void {
    Object.keys(localMetrics).forEach((key) => delete localMetrics[key]);
  }
}

// Singleton instance
export const metricsService = new MetricsService();
