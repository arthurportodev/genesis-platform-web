import { Component, type ErrorInfo, type ReactNode } from "react";

import { OperationalState } from "@/shared/components/OperationalState";

type ErrorBoundaryProps = { children: ReactNode };
type ErrorBoundaryState = { hasError: boolean };

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("Erro não tratado na interface.", error, info);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="grid min-h-screen place-items-center p-6">
          <OperationalState
            kind="error"
            title="Não foi possível exibir esta página"
            description="Atualize a página para tentar novamente. Se o problema continuar, procure o suporte."
            action={{ label: "Atualizar página", href: window.location.href }}
          />
        </main>
      );
    }

    return this.props.children;
  }
}
