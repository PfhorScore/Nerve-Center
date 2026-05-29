import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Root-level React error boundary for the Nerve Center application.
 *
 * Catches unhandled render errors and displays a full-screen crash page
 * with the error message and a reload button. Wrap the entire app tree
 * with this component. For panel-scoped recovery see {@link PanelErrorBoundary}.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex flex-col items-center justify-center bg-background text-foreground p-8">
          <h1 className="text-primary text-xl font-bold mb-4">Something went wrong</h1>
          <pre className="text-xs text-muted-foreground max-w-lg overflow-auto mb-4 p-4 bg-card border border-border">
            {this.state.error?.message}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground font-bold tracking-wider text-sm hover:opacity-90"
          >
            RELOAD
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
