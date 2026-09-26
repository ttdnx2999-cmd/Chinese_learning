/**
 * User Menu Component
 * 
 * Displays current user info and logout button.
 * Shows role and username.
 */

import React, { useState } from 'react';
import { useAuth, UserRole } from '../context/AuthContext';

const roleEmojis: Record<UserRole, string> = {
  'admin': '👑',
  'parent': '👨‍👩‍👧',
  'child': ''
};

const roleLabels: Record<UserRole, string> = {
  'admin': 'Administrator',
  'parent': 'Parent',
  'child': 'Child'
};

export function UserMenu() {
  const { user, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  if (!user) {
    return null;
  }

  return (
    <div style={styles.container}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        style={styles.button}
      >
        <span style={styles.emoji}>{roleEmojis[user.role]}</span>
        <span style={styles.username}>{user.username}</span>
        <span style={styles.arrow}>{showMenu ? '▲' : '▼'}</span>
      </button>

      {showMenu && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowMenu(false)}
            style={styles.backdrop}
          />

          {/* Menu */}
          <div style={styles.menu}>
            <div style={styles.menuItem}>
              <div style={styles.menuLabel}>Username</div>
              <div style={styles.menuValue}>{user.username}</div>
            </div>

            <div style={styles.menuItem}>
              <div style={styles.menuLabel}>Role</div>
              <div style={styles.menuValue}>
                {roleEmojis[user.role]} {roleLabels[user.role]}
              </div>
            </div>

            {user.parentId && (
              <div style={styles.menuItem}>
                <div style={styles.menuLabel}>Linked to</div>
                <div style={styles.menuValue}>Parent Account (ID: {user.parentId})</div>
              </div>
            )}

            <div style={styles.divider} />

            <button
              onClick={() => {
                logout();
                setShowMenu(false);
              }}
              style={styles.logoutButton}
            >
              🚪 Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'relative' as const,
    display: 'inline-block'
  },

  button: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: 'transparent',
    border: 'none',
    color: 'white',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    borderRadius: '4px',
    transition: 'background-color 0.2s'
  } as React.CSSProperties,

  emoji: {
    fontSize: '16px'
  },

  username: {
    maxWidth: '120px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const
  },

  arrow: {
    fontSize: '12px',
    transition: 'transform 0.2s'
  },

  backdrop: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2001
  },

  menu: {
    position: 'absolute' as const,
    top: '100%',
    right: 0,
    marginTop: '4px',
    backgroundColor: 'white',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    zIndex: 2002,
    minWidth: '240px',
    overflow: 'hidden'
  },

  menuItem: {
    padding: '12px 16px',
    borderBottom: '1px solid #eee'
  } as React.CSSProperties,

  menuLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '4px'
  } as React.CSSProperties,

  menuValue: {
    fontSize: '14px',
    color: '#333',
    fontWeight: '500'
  },

  divider: {
    height: '1px',
    backgroundColor: '#eee'
  },

  logoutButton: {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#d32f2f',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    textAlign: 'left' as const,
    transition: 'background-color 0.2s'
  } as React.CSSProperties
};

export default UserMenu;
