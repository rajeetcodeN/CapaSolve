/**
 * Production-Grade Structured Logging & Error Telemetry Service for CapaSolve
 * Supports structured JSON logging, breadcrumb tracking, and optional Sentry/remote telemetry.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogPayload {
  level: LogLevel;
  message: string;
  context?: string;
  data?: Record<string, unknown>;
  timestamp: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface Breadcrumb {
  category: string;
  message: string;
  level: LogLevel;
  timestamp: string;
  data?: Record<string, unknown>;
}

class TelemetryService {
  private breadcrumbs: Breadcrumb[] = [];
  private readonly maxBreadcrumbs = 50;
  private isProduction = import.meta.env.PROD;
  private sentryDsn = import.meta.env.VITE_SENTRY_DSN;

  constructor() {
    this.initGlobalHandlers();
  }

  private initGlobalHandlers() {
    if (typeof window === "undefined") return;

    // Unhandled promise rejections
    window.addEventListener("unhandledrejection", (event) => {
      this.error("Unhandled Promise Rejection", {
        reason: event.reason,
      });
    });

    // Global error listener
    window.addEventListener("error", (event) => {
      this.error("Uncaught Window Error", {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });
  }

  public addBreadcrumb(
    category: string,
    message: string,
    data?: Record<string, unknown>,
    level: LogLevel = "info",
  ) {
    const crumb: Breadcrumb = {
      category,
      message,
      level,
      data,
      timestamp: new Date().toISOString(),
    };
    this.breadcrumbs.push(crumb);
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }
  }

  public getBreadcrumbs(): readonly Breadcrumb[] {
    return this.breadcrumbs;
  }

  private formatLog(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
    err?: Error,
  ): LogPayload {
    return {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
      ...(err
        ? {
            error: {
              name: err.name,
              message: err.message,
              stack: err.stack,
            },
          }
        : {}),
    };
  }

  public debug(message: string, data?: Record<string, unknown>) {
    if (!this.isProduction) {
      const payload = this.formatLog("debug", message, data);
      console.debug(`[DEBUG] ${message}`, payload);
    }
  }

  public info(message: string, data?: Record<string, unknown>) {
    const payload = this.formatLog("info", message, data);
    console.info(`[INFO] ${message}`, payload);
    this.addBreadcrumb("log", message, data, "info");
  }

  public warn(message: string, data?: Record<string, unknown>) {
    const payload = this.formatLog("warn", message, data);
    console.warn(`[WARN] ${message}`, payload);
    this.addBreadcrumb("log", message, data, "warn");
  }

  public error(
    message: string,
    errorOrData?: Error | Record<string, unknown>,
    maybeData?: Record<string, unknown>,
  ) {
    let err: Error | undefined;
    let data: Record<string, unknown> | undefined;

    if (errorOrData instanceof Error) {
      err = errorOrData;
      data = maybeData;
    } else {
      data = errorOrData;
    }

    const payload = this.formatLog("error", message, data, err);
    console.error(`[ERROR] ${message}`, payload);
    this.addBreadcrumb("error", message, { ...data, errorName: err?.name }, "error");

    // Remote capture if telemetry is configured
    if (typeof window !== "undefined") {
      this.dispatchToRemoteMonitoring(payload, err);
    }
  }

  public captureException(
    error: Error,
    context?: { componentStack?: string; [key: string]: unknown },
  ) {
    this.error(`Captured Exception: ${error.message}`, error, context);
  }

  private dispatchToRemoteMonitoring(payload: LogPayload, err?: Error) {
    try {
      // 1. If standard Sentry browser SDK is loaded on the page
      const win = window as any;
      if (win.Sentry && typeof win.Sentry.captureException === "function") {
        if (err) {
          win.Sentry.captureException(err, { extra: payload.data });
        } else {
          win.Sentry.captureMessage(payload.message, payload.level);
        }
        return;
      }

      // 2. Fallback to enterprise telemetry webhook endpoint if configured
      const monitoringEndpoint = import.meta.env.VITE_MONITORING_ENDPOINT;
      if (monitoringEndpoint && typeof fetch !== "undefined") {
        const telemetryBody = JSON.stringify({
          ...payload,
          breadcrumbs: this.breadcrumbs.slice(-20),
          app: "CapaSolve",
          environment: import.meta.env.MODE || "production",
          version: "1.0.0-beta",
        });

        if (navigator.sendBeacon) {
          navigator.sendBeacon(monitoringEndpoint, telemetryBody);
        } else {
          fetch(monitoringEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: telemetryBody,
            keepalive: true,
          }).catch(() => {});
        }
      }
    } catch {
      // Silently catch to avoid recursive telemetry failures
    }
  }
}

export const logger = new TelemetryService();
