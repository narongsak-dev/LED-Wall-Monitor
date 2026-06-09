import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    localStorage.removeItem('auth');
    window.location.href = '/';
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0a0e1a',
          color: '#f1f5f9',
          padding: 40,
          fontFamily: 'monospace',
        }}
      >
        <div
          style={{
            maxWidth: 900,
            margin: '0 auto',
            background: '#111729',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 12,
            padding: 24,
          }}
        >
          <h1 style={{ color: '#ef4444', marginTop: 0, fontSize: 20 }}>
            ⚠ Runtime Error
          </h1>
          <div style={{ fontSize: 14, marginBottom: 16, color: '#94a3b8' }}>
            หน้าเว็บเจอ error ระหว่างทำงาน — รายละเอียดด้านล่าง
          </div>

          <div
            style={{
              background: '#0a0e1a',
              padding: 16,
              borderRadius: 8,
              fontSize: 13,
              whiteSpace: 'pre-wrap',
              overflowX: 'auto',
              color: '#fbbf24',
              marginBottom: 12,
              border: '1px solid #30363d',
            }}
          >
            {this.state.error.message}
          </div>

          {this.state.error.stack && (
            <details style={{ marginBottom: 16 }}>
              <summary style={{ cursor: 'pointer', color: '#94a3b8' }}>
                Stack trace
              </summary>
              <pre
                style={{
                  background: '#0a0e1a',
                  padding: 16,
                  borderRadius: 8,
                  fontSize: 11,
                  overflowX: 'auto',
                  color: '#94a3b8',
                  marginTop: 8,
                  border: '1px solid #30363d',
                }}
              >
                {this.state.error.stack}
              </pre>
            </details>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 18px',
                background: '#06b6d4',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Reload
            </button>
            <button
              onClick={this.handleReset}
              style={{
                padding: '10px 18px',
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Reset (ล้าง localStorage + logout)
            </button>
          </div>
        </div>
      </div>
    );
  }
}
