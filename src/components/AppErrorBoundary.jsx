import React from "react";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: "",
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || "A page error occurred.",
    };
  }

  componentDidCatch(error, errorInfo) {
    if (typeof window !== "undefined") {
      window.__ENROLLEASE_RUNTIME_ERROR__ = {
        message: error?.message || "A page error occurred.",
        stack: error?.stack || "",
        componentStack: errorInfo?.componentStack || "",
        capturedAt: new Date().toISOString(),
      };
    }

    console.error("EnrollEase runtime error:", error, errorInfo);
  }

  handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas px-6">
          <div className="hero-orb left-[-5rem] top-10 h-56 w-56 bg-brand-100/70" />
          <div className="hero-orb bottom-[-6rem] right-[-3rem] h-72 w-72 bg-accent-100/70" />
          <div className="panel relative w-full max-w-2xl px-8 py-10 text-center">
            <p className="section-kicker">Runtime issue</p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.05em] text-slate-950">
              EnrollEase hit an unexpected error
            </h1>
            <p className="mt-4 text-sm text-slate-600">
              The page did not load correctly. Refresh once to retry. If this keeps happening, the latest error is now
              captured in the browser for debugging.
            </p>
            <p className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {this.state.errorMessage}
            </p>
            <div className="mt-6 flex justify-center">
              <button type="button" className="button-primary" onClick={this.handleReload}>
                Reload page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
