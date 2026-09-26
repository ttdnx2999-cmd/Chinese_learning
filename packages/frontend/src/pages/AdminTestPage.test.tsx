import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import AdminTestPage from './AdminTestPage';
import { apiClient } from '../api/client';

const auth = vi.hoisted(() => ({ isLoading: false, setUser: vi.fn(), setToken: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../api/client', () => ({
  apiClient: { post: vi.fn(), defaults: { headers: { common: {} } } }
}));

function renderPage() {
  return render(<MemoryRouter initialEntries={['/admin-test']}>
    <Routes>
      <Route path="/admin-test" element={<AdminTestPage />} />
      <Route path="/" element={<h1>Home</h1>} />
    </Routes>
  </MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.isLoading = false;
  localStorage.clear();
  delete apiClient.defaults.headers.common.Authorization;
});
afterEach(cleanup);

test('opens home with an admin session without requesting a password', async () => {
  const user = { userId: 1, username: 'admin', role: 'admin', parentId: null };
  const token = `e30.${btoa(JSON.stringify(user))}.signature`;
  vi.mocked(apiClient.post).mockResolvedValue({ data: { token } });
  renderPage();
  expect(await screen.findByText('Home')).toBeInTheDocument();
  expect(apiClient.post).toHaveBeenCalledWith('/auth/admin-test');
  expect(auth.setUser).toHaveBeenCalledWith(user);
  expect(auth.setToken).toHaveBeenCalledWith(token);
  expect(localStorage.getItem('auth_token')).toBe(token);
  expect(apiClient.defaults.headers.common.Authorization).toBe(`Bearer ${token}`);
});

test('waits for existing session initialization before replacing it', async () => {
  auth.isLoading = true;
  renderPage();
  expect(screen.getByRole('status')).toBeInTheDocument();
  expect(apiClient.post).not.toHaveBeenCalled();
});

test('shows disabled response without granting a session', async () => {
  vi.mocked(apiClient.post).mockRejectedValue({ response: { data: { error: 'Temporary admin access is disabled' } } });
  renderPage();
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Temporary admin access is disabled'));
  expect(auth.setToken).not.toHaveBeenCalled();
  expect(localStorage.getItem('auth_token')).toBeNull();
});
