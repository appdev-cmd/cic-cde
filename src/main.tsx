import React, {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Lưới an toàn: lỗi render bất ngờ hiện thông báo + nút tải lại,
// thay vì trắng trang làm mất hết trạng thái phiên làm việc.
interface EBProps { children: React.ReactNode }
interface EBState { error: Error | null }
class ErrorBoundary extends React.Component<EBProps, EBState> {
  // Dự án không cài @types/react (React = any) nên khai báo tường minh props/state
  declare props: EBProps;
  state: EBState = { error: null };
  static getDerivedStateFromError(error: Error): EBState { return { error }; }
  componentDidCatch(error: Error, info: unknown) { console.error('App crash:', error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: 'sans-serif', padding: 24, textAlign: 'center' }}>
          <h2 style={{ margin: 0 }}>Đã xảy ra lỗi không mong muốn</h2>
          <p style={{ color: '#666', maxWidth: 480, fontSize: 14 }}>{String(this.state.error?.message || this.state.error)}</p>
          <button onClick={() => window.location.reload()} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#0c59a9', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            Tải lại ứng dụng
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
