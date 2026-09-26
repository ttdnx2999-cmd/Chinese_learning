/**
 * Admin Panel Page
 * 
 * Allows administrators to manage users, create accounts, and configure permissions.
 * Only accessible to admin users.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';

interface User {
  id: number;
  username: string;
  role: 'admin' | 'parent' | 'child';
  parentId: number | null;
  isActive: boolean;
  createdAt: string;
}

interface CreateUserForm {
  username: string;
  role: 'parent' | 'child';
  parentId: number | null;
  autoGenerate: boolean;
  secretPhrase: string;
}

export default function AdminPanelPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'create'>('users');
  const [form, setForm] = useState<CreateUserForm>({
    username: '',
    role: 'parent',
    parentId: null,
    autoGenerate: true,
    secretPhrase: ''
  });
  const [createdUser, setCreatedUser] = useState<any>(null);
  const [copiedPhrase, setCopiedPhrase] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ username: '', newSecretPhrase: '' });

  // Verify user is admin
  if (user?.role !== 'admin') {
    return (
      <div style={{ padding: '20px', color: '#d32f2f' }}>
        <p>❌ Access Denied</p>
        <p>Only administrators can access this page.</p>
      </div>
    );
  }

  // Load users
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/admin/users');
      setUsers(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Error loading users:', err);
      setError('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      if (!form.username.trim()) {
        throw new Error('Username is required');
      }

      if (form.role === 'child' && !form.parentId) {
        throw new Error('Parent ID is required for child users');
      }

      const response = await apiClient.post('/admin/users', {
        username: form.username.trim(),
        role: form.role,
        parentId: form.parentId,
        autoGenerate: form.autoGenerate,
        secretPhrase: form.autoGenerate ? undefined : form.secretPhrase
      });

      setCreatedUser(response.data);
      setForm({
        username: '',
        role: 'parent',
        parentId: null,
        autoGenerate: true,
        secretPhrase: ''
      });

      // Reload users list
      await loadUsers();
    } catch (err: any) {
      console.error('Error creating user:', err);
      console.error('Full error:', {
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        message: err.message
      });
      setError(err.response?.data?.error || err.message || 'Failed to create user');
    }
  };

  const copyToClipboard = (text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          setCopiedPhrase(true);
          setTimeout(() => setCopiedPhrase(false), 2000);
        }).catch(() => {
          // Fallback to old method
          fallbackCopyToClipboard(text);
        });
      } else {
        // Fallback for non-secure contexts
        fallbackCopyToClipboard(text);
      }
    } catch (err) {
      console.error('Clipboard error:', err);
      fallbackCopyToClipboard(text);
    }
  };

  const fallbackCopyToClipboard = (text: string) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedPhrase(true);
      setTimeout(() => setCopiedPhrase(false), 2000);
    } catch (err) {
      console.error('Fallback copy error:', err);
      alert('Copy to clipboard failed. Please copy manually:\n\n' + text);
    }
  };

  const handleEditUser = (userToEdit: User) => {
    setEditingUser(userToEdit);
    setEditForm({ username: userToEdit.username, newSecretPhrase: '' });
  };

  const handleSaveEditUser = async () => {
    if (!editingUser) return;

    try {
      setError(null);
      const updates: any = {};

      if (editForm.username && editForm.username !== editingUser.username) {
        updates.username = editForm.username;
      }
      if (editForm.newSecretPhrase) {
        updates.secretPhrase = editForm.newSecretPhrase;
      }

      if (Object.keys(updates).length === 0) {
        setEditingUser(null);
        return;
      }

      const response = await apiClient.put(`/admin/users/${editingUser.id}`, updates);
      
      // Update users list
      setUsers(users.map(u => u.id === editingUser.id ? { ...u, ...response.data } : u));
      setEditingUser(null);
      setEditForm({ username: '', newSecretPhrase: '' });
    } catch (err: any) {
      console.error('Error updating user:', err);
      setError(err.response?.data?.error || 'Failed to update user');
    }
  };

  const handleDeactivateUser = async (userToDeactivate: User) => {
    if (!window.confirm(`Deactivate user "${userToDeactivate.username}"? They will be logged out and cannot log in.`)) {
      return;
    }

    try {
      setError(null);
      await apiClient.delete(`/admin/users/${userToDeactivate.id}`);
      
      // Reload users list
      await loadUsers();
      setEditingUser(null);
    } catch (err: any) {
      console.error('Error deactivating user:', err);
      setError(err.response?.data?.error || 'Failed to deactivate user');
    }
  };

  const handleDeleteUser = async (userToDelete: User) => {
    if (!window.confirm(`Delete user "${userToDelete.username}" permanently? This will remove them from the database and cannot be undone!`)) {
      return;
    }

    try {
      setError(null);
      await apiClient.delete(`/admin/users/${userToDelete.id}`);
      
      // Remove from users list immediately for UI responsiveness
      setUsers(users.filter(u => u.id !== userToDelete.id));
      setEditingUser(null);
      
      // Also reload to ensure consistency
      await loadUsers();
    } catch (err: any) {
      console.error('Error deleting user:', err);
      setError(err.response?.data?.error || 'Failed to delete user');
    }
  };

  const parentUsers = users.filter(u => (u.role === 'parent' || u.role === 'admin') && u.isActive);

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>👑 Admin Panel</h1>

      {/* Tab Navigation */}
      <div style={styles.tabNav}>
        <button
          onClick={() => setActiveTab('users')}
          style={{
            ...styles.tabButton,
            ...(activeTab === 'users' ? styles.tabButtonActive : {})
          }}
        >
          👥 Users ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('create')}
          style={{
            ...styles.tabButton,
            ...(activeTab === 'create' ? styles.tabButtonActive : {})
          }}
        >
          ➕ Create User
        </button>
      </div>

      {error && (
        <div style={styles.errorBox}>
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div>
          {isLoading ? (
            <div style={styles.loading}>🔄 Loading users...</div>
          ) : (
            <div style={styles.usersList}>
              {users.length === 0 ? (
                <p>No users found</p>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeader}>
                      <th style={styles.tableCell}>ID</th>
                      <th style={styles.tableCell}>Username</th>
                      <th style={styles.tableCell}>Role</th>
                      <th style={styles.tableCell}>Parent</th>
                      <th style={styles.tableCell}>Created</th>
                      <th style={styles.tableCell}>Status</th>
                      <th style={styles.tableCell}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} style={styles.tableRow}>
                        <td style={styles.tableCell}><strong>{u.id}</strong></td>
                        <td style={styles.tableCell}>{u.username}</td>
                        <td style={styles.tableCell}>
                          {u.role === 'admin' && '👑 Admin'}
                          {u.role === 'parent' && '👨‍👩‍👧 Parent'}
                          {u.role === 'child' && 'Child'}
                        </td>
                        <td style={styles.tableCell}>{u.parentId ? `ID: ${u.parentId}` : '—'}</td>
                        <td style={styles.tableCell}>{new Date(u.createdAt).toLocaleDateString()}</td>
                        <td style={styles.tableCell}>
                          {u.isActive ? (
                            <span style={{ color: '#4caf50' }}>✓ Active</span>
                          ) : (
                            <span style={{ color: '#999' }}>✗ Inactive</span>
                          )}
                        </td>
                        <td style={styles.tableCell}>
                          <button
                            onClick={() => handleEditUser(u)}
                            style={styles.actionButton}
                            title="Edit user"
                          >
                            ✎ Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create User Tab */}
      {activeTab === 'create' && (
        <div>
          {/* Success Message */}
          {createdUser && (
            <div style={styles.successBox}>
              <h3 style={{ marginTop: 0 }}>✓ User Created Successfully</h3>
              <div style={styles.userDetails}>
                <p><strong>Username:</strong> {createdUser.user.username}</p>
                <p><strong>Role:</strong> {createdUser.user.role}</p>
              </div>

              <div style={styles.phraseBox}>
                <p style={{ marginTop: 0, fontSize: '14px', color: '#d32f2f', fontWeight: 'bold' }}>
                  ⚠️ Save this credentials somewhere safe - they will not be shown again!
                </p>
                
                {/* Username and Phrase Display */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <strong>Username:</strong>
                    <code style={{ display: 'block', fontSize: '14px', marginTop: '4px', padding: '8px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                      {createdUser.user.username}
                    </code>
                  </div>
                  <div>
                    <strong>Secret Phrase:</strong>
                    <code style={{ display: 'block', fontSize: '14px', marginTop: '4px', padding: '8px', backgroundColor: '#f5f5f5', borderRadius: '4px', fontWeight: 'bold' }}>
                      {createdUser.secretPhrase}
                    </code>
                  </div>
                </div>

                {/* Copy Buttons */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      console.log('Copy Username clicked:', createdUser.user.username);
                      copyToClipboard(createdUser.user.username);
                    }}
                    style={styles.copyButton}
                  >
                    Copy Username
                  </button>
                  <button
                    onClick={() => {
                      console.log('Copy Phrase clicked:', createdUser.secretPhrase);
                      copyToClipboard(createdUser.secretPhrase);
                    }}
                    style={styles.copyButton}
                  >
                    Copy Phrase
                  </button>
                  <button
                    onClick={() => {
                      console.log('Copy Both clicked');
                      copyToClipboard(`Username: ${createdUser.user.username}\nSecret Phrase: ${createdUser.secretPhrase}`);
                    }}
                    style={{ ...styles.copyButton, backgroundColor: '#28a745' }}
                  >
                    Copy Both
                  </button>
                </div>
              </div>

              <button
                onClick={() => setCreatedUser(null)}
                style={styles.primaryButton}
              >
                Create Another User
              </button>
            </div>
          )}

          {/* Create Form */}
          {!createdUser && (
            <form onSubmit={handleCreateUser} style={styles.form}>
              {/* Username */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Username</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="e.g., lucy_mom"
                  style={styles.input}
                />
              </div>

              {/* Role Selection */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Account Type</label>
                <div style={styles.radioGroup}>
                  <label style={styles.radioLabel}>
                    <input
                      type="radio"
                      value="parent"
                      checked={form.role === 'parent'}
                      onChange={(e) => setForm({ ...form, role: e.target.value as any, parentId: null })}
                    />
                    👨‍👩‍👧 Parent Account
                  </label>
                  <label style={styles.radioLabel}>
                    <input
                      type="radio"
                      value="child"
                      checked={form.role === 'child'}
                      onChange={(e) => setForm({ ...form, role: e.target.value as any })}
                    />
                    Child Account
                  </label>
                </div>
              </div>

              {/* Parent Selection (if child) */}
              {form.role === 'child' && (
                <div style={styles.formGroup}>
                  <label style={styles.label}>Link to Parent</label>
                  <select
                    value={form.parentId || ''}
                    onChange={(e) => setForm({ ...form, parentId: e.target.value ? parseInt(e.target.value) : null })}
                    style={styles.select}
                  >
                    <option value="">-- Select a parent --</option>
                    {parentUsers.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.username} (ID: {p.id})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Secret Phrase */}
              <div style={styles.formGroup}>
                <div style={styles.labelRow}>
                  <label style={styles.label}>Secret Phrase</label>
                  <label style={styles.toggleLabel}>
                    <input
                      type="checkbox"
                      checked={form.autoGenerate}
                      onChange={(e) => setForm({ ...form, autoGenerate: e.target.checked })}
                    />
                    Auto-generate
                  </label>
                </div>

                {form.autoGenerate ? (
                  <div style={styles.infoBox}>
                    💡 A random, memorable phrase will be generated automatically.
                    <br />
                    Example: <code>purple-elephant-42-dancing</code>
                  </div>
                ) : (
                  <div style={styles.inputWithButton}>
                    <input
                      type="text"
                      value={form.secretPhrase}
                      onChange={(e) => setForm({ ...form, secretPhrase: e.target.value })}
                      placeholder="Enter custom secret phrase"
                      style={styles.input}
                    />
                    {form.secretPhrase && (
                      <button
                        type="button"
                        onClick={() => {
                          copyToClipboard(form.secretPhrase);
                        }}
                        style={styles.copyButton}
                      >
                        {copiedPhrase ? '✓ Copied!' : 'Copy'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button type="submit" style={styles.primaryButton}>
                ✓ Create Account
              </button>
            </form>
          )}
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setEditingUser(null)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 3000
            }}
          />

          {/* Modal */}
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
              zIndex: 3001,
              padding: '24px'
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Edit User: {editingUser.username}</h2>

            {/* Username Field */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Username</label>
              <input
                type="text"
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                placeholder={editingUser.username}
                style={styles.input}
              />
            </div>

            {/* New Secret Phrase Field */}
            <div style={styles.formGroup}>
              <label style={styles.label}>New Secret Phrase (leave empty to keep current)</label>
              <div style={styles.inputWithButton}>
                <input
                  type="text"
                  value={editForm.newSecretPhrase}
                  onChange={(e) => setEditForm({ ...editForm, newSecretPhrase: e.target.value })}
                  placeholder="Enter new secret phrase"
                  style={styles.input}
                />
                {editForm.newSecretPhrase && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(editForm.newSecretPhrase)}
                    style={styles.copyButton}
                  >
                    {copiedPhrase ? '✓ Copied!' : 'Copy'}
                  </button>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={handleSaveEditUser}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                ✓ Save Changes
              </button>
              <button
                onClick={() => handleDeactivateUser(editingUser)}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#ffc107',
                  color: '#333',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                🚫 Deactivate
              </button>
              <button
                onClick={() => handleDeleteUser(editingUser)}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#d32f2f',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                🗑️ Delete
              </button>
              <button
                onClick={() => setEditingUser(null)}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#666',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                ✕ Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  } as React.CSSProperties,

  title: {
    fontSize: '28px',
    marginBottom: '24px',
    color: '#333'
  } as React.CSSProperties,

  tabNav: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
    borderBottom: '2px solid #eee'
  } as React.CSSProperties,

  tabButton: {
    padding: '12px 20px',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '3px solid transparent',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    color: '#666',
    transition: 'all 0.2s'
  } as React.CSSProperties,

  tabButtonActive: {
    color: '#007bff',
    borderBottomColor: '#007bff'
  } as React.CSSProperties,

  errorBox: {
    padding: '12px 16px',
    marginBottom: '20px',
    backgroundColor: '#fff3cd',
    border: '1px solid #ffc107',
    borderRadius: '6px',
    color: '#856404'
  } as React.CSSProperties,

  loading: {
    textAlign: 'center' as const,
    padding: '40px 20px',
    color: '#666'
  } as React.CSSProperties,

  usersList: {
    overflowX: 'auto'
  } as React.CSSProperties,

  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    border: '1px solid #ddd'
  } as React.CSSProperties,

  tableHeader: {
    backgroundColor: '#f5f5f5',
    borderBottom: '2px solid #ddd'
  } as React.CSSProperties,

  tableRow: {
    borderBottom: '1px solid #ddd'
  } as React.CSSProperties,

  tableCell: {
    padding: '12px',
    textAlign: 'left' as const,
    fontSize: '14px'
  } as React.CSSProperties,

  form: {
    maxWidth: '500px',
    padding: '20px',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    border: '1px solid #eee'
  } as React.CSSProperties,

  formGroup: {
    marginBottom: '20px'
  } as React.CSSProperties,

  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  } as React.CSSProperties,

  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#333',
    marginBottom: '6px'
  } as React.CSSProperties,

  toggleLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    fontWeight: 'normal',
    color: '#666',
    cursor: 'pointer'
  } as React.CSSProperties,

  input: {
    width: '100%',
    padding: '10px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    boxSizing: 'border-box',
    fontFamily: 'inherit'
  } as React.CSSProperties,

  inputWithButton: {
    display: 'flex',
    gap: '8px',
    alignItems: 'stretch'
  } as React.CSSProperties,

  select: {
    width: '100%',
    padding: '10px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    boxSizing: 'border-box',
    fontFamily: 'inherit'
  } as React.CSSProperties,

  radioGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px'
  } as React.CSSProperties,

  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    cursor: 'pointer'
  } as React.CSSProperties,

  infoBox: {
    padding: '12px',
    backgroundColor: '#e7f3ff',
    border: '1px solid #b3d9ff',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#004085',
    lineHeight: '1.5'
  } as React.CSSProperties,

  successBox: {
    padding: '20px',
    marginBottom: '24px',
    backgroundColor: '#d4edda',
    border: '1px solid #c3e6cb',
    borderRadius: '8px',
    color: '#155724'
  } as React.CSSProperties,

  userDetails: {
    marginBottom: '16px',
    fontSize: '14px'
  } as React.CSSProperties,

  phraseBox: {
    padding: '16px',
    marginBottom: '16px',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: '6px',
    border: '1px solid rgba(0,0,0,0.1)'
  } as React.CSSProperties,

  phraseDisplay: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    backgroundColor: '#f5f5f5',
    borderRadius: '4px',
    marginTop: '12px'
  } as React.CSSProperties,

  copyButton: {
    padding: '8px 12px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0
  } as React.CSSProperties,

  primaryButton: {
    width: '100%',
    padding: '12px',
    marginTop: '12px',
    fontSize: '14px',
    fontWeight: '600',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  } as React.CSSProperties,

  actionButton: {
    padding: '6px 10px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
    marginRight: '8px',
    transition: 'background-color 0.2s'
  } as React.CSSProperties
};
