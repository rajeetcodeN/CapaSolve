import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/error-tracking";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.captureException(error, {
      componentStack: errorInfo.componentStack || undefined,
    });
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = "/dashboard";
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
          <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-950/50 border border-red-800/60 rounded-full flex items-center justify-center mx-auto mb-6 text-red-400">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
              Application Error Encountered
            </h1>

            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              CapaSolve encountered an unexpected condition while processing scheduling data. No
              data has been corrupted. You can reload the application or return to the main
              dashboard.
            </p>

            {this.state.error && (
              <div className="text-left bg-slate-950/80 border border-slate-800/80 rounded-lg p-3.5 mb-6 text-xs text-red-300 font-mono overflow-x-auto max-h-32">
                <p className="font-semibold text-red-400 mb-1">
                  {this.state.error.name}: {this.state.error.message}
                </p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="text-[10px] text-slate-500 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack.slice(0, 300)}...
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                variant="outline"
                onClick={this.handleGoHome}
                className="w-full sm:w-auto border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-200"
              >
                <Home className="w-4 h-4 mr-2" />
                Return to Dashboard
              </Button>

              <Button
                onClick={this.handleReset}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/30"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reload Application
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
