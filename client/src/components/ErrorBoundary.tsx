import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

// Without this, any uncaught render-time exception (a bad prop, a missing
// field on a fresh API response, ...) unmounts the whole React tree and
// leaves a blank white screen with zero feedback - this has been the root
// symptom behind several "static button, nothing happens" reports this
// session, each with a different underlying cause. This doesn't fix those
// causes, it makes the failure mode recoverable and visible instead of a
// silent blank page.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] render crash", error, info.componentStack);
  }

  render() {
    // Renders blank on a crash instead of a visible error card - the crash
    // is still fully logged to the console (componentDidCatch above) for
    // debugging, this only changes what the user sees.
    if (this.state.error) {
      return null;
    }

    return this.props.children;
  }
}
