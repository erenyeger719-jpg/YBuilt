import React from "react";

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error?: Error }
> {
  state = { error: undefined as Error | undefined };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(err: Error) {
    console.error("UI crash:", err);
  }

  render() {
    if (this.state.error) {
      return (
        <pre style={{ padding: 16, color: "red", whiteSpace: "pre-wrap" }}>
          App crashed: {this.state.error.message}
          {"\n\n"}
          {this.state.error.stack}
        </pre>
      );
    }
    return this.props.children as any;
  }
}
