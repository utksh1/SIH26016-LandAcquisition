import { StrictMode, Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('CRITICAL React UI Error caught by ErrorBoundary:', error, errorInfo)
  }

  handleReload = () => {
    localStorage.removeItem('active_project_id')
    window.location.hash = ''
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#090d16',
          color: '#e2e8f0',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '24px',
          textAlign: 'center'
        }}>
          <div style={{
            maxWidth: '560px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#f87171', marginBottom: '8px' }}>
              Application Render Encountered an Error
            </h2>
            <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '20px', lineHeight: 1.5 }}>
              The portal encountered an unexpected runtime error. You can reload the page or reset the portal state.
            </p>
            {this.state.error && (
              <pre style={{
                background: '#040711',
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#fca5a5',
                overflowX: 'auto',
                textAlign: 'left',
                marginBottom: '20px',
                border: '1px solid rgba(255,255,255,0.06)'
              }}>
                {this.state.error.message}
              </pre>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  background: '#2563eb',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '14px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Reload Page
              </button>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#e2e8f0',
                  fontWeight: 600,
                  fontSize: '14px',
                  border: '1px solid rgba(255,255,255,0.15)',
                  cursor: 'pointer'
                }}
              >
                Reset & Reload
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

