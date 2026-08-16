import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../src/App';

function renderApp(){
  const qc = new QueryClient({ defaultOptions: { queries: { retry:false } } });
  return render(<QueryClientProvider client={qc}><BrowserRouter><App/></BrowserRouter></QueryClientProvider>);
}

describe('App', () => {
  it('renders Pragmatic header', async () => {
    renderApp();
    expect(screen.getAllByText(/Pragmatic/i).length).toBeGreaterThan(0);
  });
  it('shows Thai workspace heading or login prompt', async () => {
    renderApp();
    const el = screen.queryByText(/พื้นที่ทำงาน AI ของคุณ/) || screen.queryByText(/ยินดีต้อนรับ/) || screen.queryByText(/เข้าสู่ระบบ/);
    expect(el).toBeTruthy();
  });
  it('exposes health dot', async () => {
    renderApp();
    expect(screen.getAllByText(/API/).length).toBeGreaterThan(0);
  });
});
