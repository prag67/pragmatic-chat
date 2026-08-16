import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../src/App';

describe('App', () => {
  it('renders Pragmatic header', () => {
    render(<App />);
    expect(screen.getAllByText(/Pragmatic/i).length).toBeGreaterThan(0);
  });
  it('shows health placeholder', () => {
    render(<App />);
    expect(screen.getByText(/Your AI Workspace/i)).toBeDefined();
  });
});
