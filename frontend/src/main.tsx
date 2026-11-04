import { t as tr } from "./i18n";
import { useUILanguage } from "./i18n";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { CommandProvider } from "./commands";
import "./style.css";
class ErrorBoundary extends React.Component<
  {
    children: React.ReactNode;
  },
  {
    error: string;
  }
> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <div className="boot-screen">
        <h1>{tr("An interface error occurred.")}</h1>
        <p>{this.state.error}</p>
        <p>{tr("Close and reopen TinkerCraft to restore your saved tabs.")}</p>
      </div>
    ) : (
      this.props.children
    );
  }
}
function LocalizedApplication() {
  useUILanguage();
  return (
    <ErrorBoundary>
      <CommandProvider>
        <App />
      </CommandProvider>
    </ErrorBoundary>
  );
}
createRoot(document.getElementById("root")!).render(<LocalizedApplication />);
