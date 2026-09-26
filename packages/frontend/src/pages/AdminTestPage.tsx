import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { apiClient } from '../api/client';
import { useAuth, User } from '../context/AuthContext';

export default function AdminTestPage() {
  const { isLoading, setUser, setToken } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (isLoading) return;
    let cancelled = false;
    setError('');
    apiClient.post('/auth/admin-test').then(({ data }) => {
      if (cancelled) return;
      const user = jwtDecode<User>(data.token);
      if (user.role !== 'admin') throw new Error('Admin access was not granted');
      localStorage.setItem('auth_token', data.token);
      apiClient.defaults.headers.common.Authorization = `Bearer ${data.token}`;
      setToken(data.token);
      setUser(user);
      navigate('/', { replace: true });
    }).catch((err) => {
      if (!cancelled) setError(err.response?.data?.error || 'Unable to open admin testing. Please try again.');
    });
    return () => { cancelled = true; };
  }, [isLoading, setUser, setToken, navigate, attempt]);

  return (
    <section style={{ maxWidth: 600, margin: '40px auto', padding: 24 }}>
      <h1>Admin testing</h1>
      {error ? <>
        <p role="alert">{error}</p>
        <button onClick={() => setAttempt(value => value + 1)}>Try again</button>
        <p><Link to="/login">Go to login</Link></p>
      </> : <p role="status">Opening the admin home page...</p>}
    </section>
  );
}
