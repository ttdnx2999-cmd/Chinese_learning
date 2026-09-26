import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { adminApi } from '../api/client';

export default function DatabaseAdmin() {
  const { user, token } = useAuth();
  const temporaryAdminToken = user?.role === 'admin' && user.temporaryAdmin ? token : null;
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [sessionToken, setAuthToken] = useState('');
  const authToken = temporaryAdminToken || sessionToken;
  const [loading, setLoading] = useState(false);

  const handleAuthenticate = async () => {
    setLoading(true);
    try {
      const response = await adminApi.authenticate(password, user?.username || '');
      if (response.data.success && response.data.token) {
        setAuthenticated(true);
        setAuthToken(response.data.token);
      } else {
        alert('Incorrect password');
      }
    } catch (error) {
      console.error('Authentication failed:', error);
      alert('Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      const response = await adminApi.backup(authToken, user?.username);
      const url = window.URL.createObjectURL(new Blob([JSON.stringify(response.data, null, 2)]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      alert('Database exported successfully!');
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminExportComplete = async () => {
    setLoading(true);
    try {
      const response = await adminApi.exportComplete(authToken);
      const url = window.URL.createObjectURL(new Blob([JSON.stringify(response.data, null, 2)]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `admin-backup-complete-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      alert('Complete database exported successfully (all users + vocabulary)!');
    } catch (error) {
      console.error('Complete export failed:', error);
      alert('Complete export failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminImportComplete = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!confirm('⚠️ WARNING: This will ERASE ALL DATA in the database!\n\nAll users, passwords, and vocabulary will be deleted and replaced with the backup file.\n\nAre you absolutely sure? Type "yes" to confirm.')) {
      event.target.value = '';
      return;
    }

    // Double confirmation with typed confirmation
    const confirmed = prompt('Type "yes" to confirm you want to erase everything and import the backup:');
    if (confirmed !== 'yes') {
      event.target.value = '';
      alert('Import cancelled');
      return;
    }

    setLoading(true);
    try {
      const fileContent = await file.text();
      const backupData = JSON.parse(fileContent);
      
      const response = await adminApi.importComplete(backupData, authToken);
      console.log('Complete import response:', response);
      alert(
        `Complete database imported successfully!\n` +
        `Users restored: ${response.data.usersRestored}\n` +
        `Entries restored: ${response.data.entriesRestored}\n\n` +
        `Page will reload...`
      );
      // Reload page to reflect changes
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      console.error('Complete import failed:', error);
      const errorMsg = error.response?.data?.error || error.response?.data?.details || error.message || 'Unknown error';
      alert(`Complete import failed: ${errorMsg}`);
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!confirm('This will erase all existing data and import new vocabulary. Continue?')) {
      event.target.value = '';
      return;
    }

    setLoading(true);
    try {
      const fileContent = await file.text();
      const backupData = JSON.parse(fileContent);
      
      // Pass current user's username with the restore request
      const response = await adminApi.restore(
        {
          backupFile: backupData,
          username: user?.username || 'admin'
        },
        authToken
      );
      console.log('Import response:', response);
      alert(
        `Database restored successfully!\n` +
        `Entries imported: ${response.data.entriesRestored}\n` +
        `Assigned to: ${response.data.assignedTo}`
      );
    } catch (error: any) {
      console.error('Import failed:', error);
      const errorMsg = error.response?.data?.error || error.response?.data?.details || error.message || 'Unknown error';
      alert(`Import failed: ${errorMsg}`);
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  if (!authenticated && !temporaryAdminToken) {
    return (
      <div className="database-admin">
        <h2>Database Administration</h2>
        <div>
          <label>Your Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAuthenticate()}
          />
          <button onClick={handleAuthenticate} disabled={loading}>
            Authenticate
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="database-admin">
      <h2>Database Administration</h2>
      <p>
        <strong>Importing as:</strong> {user?.username || 'unknown'}
      </p>

      {user?.role === 'admin' && (
        <>
          <div style={{
            padding: '20px',
            backgroundColor: '#ffe0e0',
            borderRadius: '8px',
            border: '2px solid #d32f2f',
            marginBottom: '20px'
          }}>
            <h3 style={{ marginTop: 0, color: '#d32f2f' }}>🔐 Admin Complete Backup/Restore</h3>
            <p style={{ color: '#666' }}>
              Export or import <strong>EVERYTHING</strong> including all users and their complete vocabulary data.
            </p>
            
            <div style={{ marginBottom: '15px' }}>
              <h4>Admin Export (Complete Database)</h4>
              <p>Downloads all users and all vocabulary from all users.</p>
              <button 
                onClick={handleAdminExportComplete} 
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1
                }}
              >
                📥 Admin Export Complete Database
              </button>
            </div>

            <div>
              <h4>Admin Import (Complete Database)</h4>
              <p style={{ color: '#d32f2f', fontWeight: 'bold' }}>
                ⚠️ WARNING: This will DELETE EVERYTHING and import from the backup file!
              </p>
              <input
                type="file"
                accept=".json"
                onChange={handleAdminImportComplete}
                disabled={loading}
                style={{
                  padding: '10px',
                  border: '2px solid #d32f2f',
                  borderRadius: '4px'
                }}
              />
            </div>
          </div>
        </>
      )}
      
      <div>
        <h3>Export Database (User Only)</h3>
        <p>Download a complete backup of all vocabulary entries for current user.</p>
        <button onClick={handleExport} disabled={loading}>
          Export Database
        </button>
      </div>
      <div>
        <h3>Import Database (User Only)</h3>
        <p>
          <strong>Warning:</strong> This will erase all existing data for <strong>{user?.username || 'admin'}</strong> and replace it
          with the backup file.
        </p>
        <input
          type="file"
          accept=".json"
          onChange={handleImport}
          disabled={loading}
        />
      </div>
    </div>
  );
}
