import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Falha inesperada.' };
  }

  componentDidCatch(error, info) {
    console.error('Erro não tratado no aplicativo:', error, info);
    try {
      const payload = {
        at: new Date().toISOString(),
        message: error?.message || String(error),
        stack: error?.stack || null,
        componentStack: info?.componentStack || null,
        path: window.location.pathname,
      };
      localStorage.setItem('matos:last_app_error', JSON.stringify(payload));
    } catch {}
  }

  handleReload = () => window.location.reload();
  handleHome = () => { window.location.href = '/admin'; };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="app-crash-screen">
        <div className="app-crash-card">
          <span className="app-crash-icon">!</span>
          <h1>O painel encontrou um erro</h1>
          <p>Seus dados não foram apagados. Recarregue a página e tente novamente.</p>
          {this.state.message && <code>{this.state.message}</code>}
          <div className="app-crash-actions">
            <button type="button" onClick={this.handleReload}>Recarregar página</button>
            <button type="button" className="secondary" onClick={this.handleHome}>Voltar ao painel</button>
          </div>
        </div>
      </div>
    );
  }
}
