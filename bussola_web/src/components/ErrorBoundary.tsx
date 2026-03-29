// bussola_web/src/components/ErrorBoundary.tsx
import { Component, ErrorInfo, ReactNode } from "react";
import { logger } from "../utils/logger";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Captura erros de renderização React que escapariam silenciosamente.
 * Loga o erro com stack trace completo e exibe uma UI de fallback.
 * Deve envolver o <App /> no main.jsx.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error("Erro de renderização React capturado pelo ErrorBoundary", {
      error_message: error.message,
      error_name: error.name,
      component_stack: info.componentStack ?? "",
      stack: error.stack ?? "",
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            gap: "16px",
            fontFamily: "sans-serif",
          }}
        >
          <h2>Algo deu errado.</h2>
          <p>Recarregue a página para tentar novamente.</p>
          <button onClick={() => window.location.reload()}>Recarregar</button>
        </div>
      );
    }

    return this.props.children;
  }
}
