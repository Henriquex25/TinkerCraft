import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { CommandProvider } from "./commands";
import "./style.css";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <div className="boot-screen">
        <h1>Ocorreu um erro na interface.</h1>
        <p>{this.state.error}</p>
        <p>Feche e reabra o TinkerCraft para restaurar as abas salvas.</p>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <CommandProvider>
      <App />
    </CommandProvider>
  </ErrorBoundary>,
);
