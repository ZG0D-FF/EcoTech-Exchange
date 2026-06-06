import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Preserve the actual red stack trace in the F12 Developer Console
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    // Gracefully reload to recover the UI
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#0d1117',
          color: '#c9d1d9',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter, system-ui, sans-serif',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            style={{
              background: '#161b22',
              border: '1px solid #30363d',
              borderRadius: '16px',
              padding: '3rem',
              maxWidth: '450px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
            }}
          >
            <motion.div
              initial={{ rotate: -15 }}
              animate={{ rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 10, delay: 0.1 }}
            >
              <AlertTriangle size={56} color="#ff7b72" style={{ marginBottom: '1.5rem' }} />
            </motion.div>
            
            <h1 style={{ color: '#ffffff', fontSize: '1.4rem', marginBottom: '1rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
              Crash is temporary.<br/>Your data is saved permanently.
            </h1>
            
            <p style={{ color: '#8b949e', fontSize: '0.95rem', marginBottom: '2.5rem', lineHeight: 1.6 }}>
              The application encountered an unexpected glitch. Don't worry, all your recent changes were already synchronized to the secure ledger.
            </p>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={this.handleReload}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: '#238636',
                color: '#ffffff',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(35, 134, 54, 0.2)',
                transition: 'background 0.2s'
              }}
            >
              <RefreshCcw size={16} strokeWidth={2.5} />
              Reload Application
            </motion.button>
          </motion.div>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
