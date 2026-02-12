/**
 * RATE LIMITING & TIMEOUT PROTECTION
 * 
 * Prevents:
 * - Bot abuse (multiple rapid requests)
 * - Excessive API costs
 * - Server overload
 * - OpenAI rate limits
 */

// ============================================================================
// CLIENT-SIDE RATE LIMITER
// ============================================================================

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  minIntervalMs: number;
}

class ClientRateLimiter {
  private requests: number[] = [];
  private lastRequestTime: number = 0;
  private config: RateLimitConfig;
  private isThrottled: boolean = false;
  private throttleEndTime: number = 0;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if request is allowed
   * Returns: { allowed: boolean, waitMs: number, reason?: string }
   */
  check(): { allowed: boolean; waitMs: number; reason?: string } {
    const now = Date.now();

    // Check if throttled (temporary ban)
    if (this.isThrottled && now < this.throttleEndTime) {
      const waitMs = this.throttleEndTime - now;
      return {
        allowed: false,
        waitMs,
        reason: `Rate limit exceeded. Try again in ${Math.ceil(waitMs / 1000)}s`,
      };
    }

    if (this.isThrottled && now >= this.throttleEndTime) {
      this.isThrottled = false;
    }

    // Check minimum interval between requests
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.config.minIntervalMs) {
      const waitMs = this.config.minIntervalMs - timeSinceLastRequest;
      return {
        allowed: false,
        waitMs,
        reason: `Too many requests. Wait ${Math.ceil(waitMs / 1000)}s between requests`,
      };
    }

    // Remove old requests outside window
    this.requests = this.requests.filter(
      (timestamp) => now - timestamp < this.config.windowMs
    );

    // Check if exceeded max requests in window
    if (this.requests.length >= this.config.maxRequests) {
      const oldestRequest = this.requests[0];
      const resetTime = oldestRequest + this.config.windowMs;
      const waitMs = resetTime - now;

      // Throttle for double the wait time
      this.isThrottled = true;
      this.throttleEndTime = now + waitMs * 2;

      return {
        allowed: false,
        waitMs: waitMs * 2,
        reason: `Rate limit: max ${this.config.maxRequests} requests per ${Math.round(this.config.windowMs / 1000)}s. Throttled temporarily.`,
      };
    }

    // Request allowed
    this.requests.push(now);
    this.lastRequestTime = now;
    return { allowed: true, waitMs: 0 };
  }

  /**
   * Get current stats
   */
  getStats() {
    const now = Date.now();
    return {
      requestsInWindow: this.requests.length,
      maxRequests: this.config.maxRequests,
      windowSeconds: Math.round(this.config.windowMs / 1000),
      isThrottled: this.isThrottled,
      throttledUntil: this.isThrottled ? new Date(this.throttleEndTime) : null,
      timeSinceLastRequest: now - this.lastRequestTime,
    };
  }

  /**
   * Reset limiter (for testing or manual reset)
   */
  reset() {
    this.requests = [];
    this.lastRequestTime = 0;
    this.isThrottled = false;
    this.throttleEndTime = 0;
  }
}

// ============================================================================
// TIMEOUT WRAPPER
// ============================================================================

/**
 * Wrap async function with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  name: string = 'Operation'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(`${name} timeout after ${timeoutMs}ms`)
          ),
        timeoutMs
      )
    ),
  ]);
}

// ============================================================================
// EXPORT SINGLETON LIMITERS
// ============================================================================

/**
 * Rate limiter for auto-load data requests
 * 3 requests per 5 minutes, min 10s between requests
 */
export const autoLoadRateLimiter = new ClientRateLimiter({
  maxRequests: 3,
  windowMs: 300000, // 5 minutes
  minIntervalMs: 10000, // 10 seconds
});

/**
 * Rate limiter for manual market scan requests
 * 5 requests per 10 minutes, min 5s between requests
 */
export const marketScanRateLimiter = new ClientRateLimiter({
  maxRequests: 5,
  windowMs: 600000, // 10 minutes
  minIntervalMs: 5000, // 5 seconds
});

/**
 * Rate limiter for on-demand analysis requests
 * 2 requests per 15 minutes (expensive!)
 */
export const analysisRateLimiter = new ClientRateLimiter({
  maxRequests: 2,
  windowMs: 900000, // 15 minutes
  minIntervalMs: 30000, // 30 seconds
});

/**
 * Generic timeout for API calls
 */
export const API_TIMEOUT_MS = 15000; // 15 seconds

/**
 * Timeout for heavy operations (OpenAI calls)
 */
export const HEAVY_OPERATION_TIMEOUT_MS = 30000; // 30 seconds
