import { useAuth } from '../context/AuthContext';

/**
 * Hook to protect child users from editing vocabulary and related features
 * Shows a popup reminder that child accounts cannot make edits
 * 
 * Usage:
 *   const showEditProtection = useChildEditProtection();
 *   
 *   const handleEdit = () => {
 *     if (showEditProtection('edit')) return;  // Shows popup and returns true
 *     // Continue with edit logic...
 *   };
 */
export function useChildEditProtection() {
  const { user } = useAuth();

  return (operation: string = 'edit'): boolean => {
    if (user?.role !== 'child') {
      return false; // Not a child, allow operation
    }

    // Child user attempting to edit - show popup
    const operationName = {
      'edit': 'edit vocabulary',
      'delete': 'delete vocabulary',
      'favorite': 'mark as favorite/unfavorite',
      'regenerate': 'regenerate phrases',
      'update': 'update entries',
      'save': 'save changes'
    }[operation] || operation;

    alert(`⚠️ You cannot make edits to this child account. Child accounts can only view vocabulary in read-only mode.\n\nOperation blocked: ${operationName}`);
    return true; // Operation was blocked
  };
}
