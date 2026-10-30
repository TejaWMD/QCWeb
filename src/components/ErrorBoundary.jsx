import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0e17] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#131926] border border-[#1e2740] rounded-xl p-6 text-center text-white">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
            <p className="text-xs text-[#a0aec0] mb-6">
              {this.state.error?.message || "An unexpected error occurred while rendering this page."}
            </p>
            <div className="flex justify-center gap-3">
              <Button
                variant="outline"
                className="border-[#1e2740] text-slate-200 hover:bg-[#1a2234]"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="w-4 h-4 mr-1.5" /> Reload Page
              </Button>
              <Button
                className="bg-[#00e5ff] text-[#0a0e17] hover:bg-[#00c3d7]"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.href = "/";
                }}
              >
                Go to Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
