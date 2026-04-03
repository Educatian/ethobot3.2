import React from 'react';

interface PanelErrorBoundaryProps {
  fallbackTitle: string;
  fallbackBody: string;
  children: React.ReactNode;
}

interface PanelErrorBoundaryState {
  hasError: boolean;
}

class PanelErrorBoundary extends React.Component<PanelErrorBoundaryProps, PanelErrorBoundaryState> {
  constructor(props: PanelErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('PanelErrorBoundary caught a panel rendering error.', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">{this.props.fallbackTitle}</p>
          <p className="mt-2 text-xs text-amber-900/80">{this.props.fallbackBody}</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default PanelErrorBoundary;
