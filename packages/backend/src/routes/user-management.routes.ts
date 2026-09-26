/**
 * User Management API Routes
 * 
 * Provides REST API endpoints for admin user management:
 * - GET /api/admin/users - List all users
 * - GET /api/admin/users/:id - Get user details
 * - POST /api/admin/users - Create new user
 * - PUT /api/admin/users/:id - Update user
 * - DELETE /api/admin/users/:id - Delete user
 * - GET /api/admin/users/:id/children - List user's children
 */

import { Router, Response } from 'express';
import { authenticateJWT, AuthRequest, requireRole } from '../middleware/auth';
import { UserDAO } from '../models/User';
import { getPool } from '../config/database';

const router = Router();

/**
 * GET /api/admin/users
 * 
 * List all users with optional filtering
 * PROTECTED: Admin only
 * 
 * Query parameters:
 * - role: Filter by role (admin, parent, child)
 * - search: Search by username
 * 
 * Response:
 * - 200: Array of users (without sensitive data)
 * - 403: Not admin
 */
router.get('/admin/users', authenticateJWT, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { role, search } = req.query;

    let users = await UserDAO.findAll();

    // Filter by role if specified
    if (role && typeof role === 'string') {
      users = users.filter(u => u.role === role);
    }

    // Search by username if specified
    if (search && typeof search === 'string') {
      const searchLower = search.toLowerCase();
      users = users.filter(u => u.username.toLowerCase().includes(searchLower));
    }

    // Convert to response format (remove sensitive data)
    const response = users.map(UserDAO.toResponse);

    res.json(response);
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

/**
 * GET /api/admin/users/:id
 * 
 * Get user details by ID
 * PROTECTED: Admin only OR user looking up their parent
 * 
 * Response:
 * - 200: User object
 * - 404: User not found
 * - 403: Not admin or not authorized
 */
router.get('/admin/users/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id, 10);

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const user = await UserDAO.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check authorization:
    // - Admin can access any user
    // - Non-admin users can only access their parent
    if (req.user && req.user.role !== 'admin') {
      // Check if this is the parent of the requesting user
      if (req.user.parentId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    res.json(UserDAO.toResponse(user));
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

/**
 * POST /api/admin/users
 * 
 * Create new user with generated secret phrase
 * PROTECTED: Admin only
 * 
 * Body:
 * - username: string (required, must be unique)
 * - role: 'admin' | 'parent' | 'child' (required)
 * - parentId: number (required if role is 'child')
 * - autoGenerate: boolean (optional, default true)
 *   - If true: system generates a random secret phrase
 *   - If false: client provides the phrase
 * - secretPhrase: string (required if autoGenerate is false)
 * 
 * Response:
 * - 201: { user, secretPhrase, expiresAt }
 * - 400: Invalid input or username exists
 * - 403: Not admin
 */
router.post('/admin/users', authenticateJWT, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    console.log('[Admin] Creating user, authenticated user:', req.user?.username);
    const { username, role, parentId, autoGenerate = true, secretPhrase } = req.body;

    console.log('[Admin] Request body:', { username, role, parentId, autoGenerate });

    // Validate input
    if (!username || typeof username !== 'string' || username.trim() === '') {
      console.log('[Admin] Validation failed: username required');
      return res.status(400).json({ error: 'Username is required' });
    }

    if (!role || !['admin', 'parent', 'child'].includes(role)) {
      console.log('[Admin] Validation failed: invalid role');
      return res.status(400).json({ error: 'Role must be admin, parent, or child' });
    }

    if (role === 'child' && !parentId) {
      console.log('[Admin] Validation failed: parent ID required for child');
      return res.status(400).json({ error: 'Parent ID is required for child users' });
    }

    if (!autoGenerate && !secretPhrase) {
      console.log('[Admin] Validation failed: secret phrase required');
      return res.status(400).json({ error: 'Secret phrase is required when autoGenerate is false' });
    }

    // Check if username already exists
    const existing = await UserDAO.findByUsername(username);
    if (existing) {
      console.log('[Admin] Username already exists:', username);
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Generate or use provided secret phrase
    let finalPhrase = secretPhrase;
    if (autoGenerate) {
      finalPhrase = generateRandomPhrase();
      console.log('[Admin] Generated phrase:', finalPhrase);
    }

    // Create user
    console.log('[Admin] Creating user with:', { username: username.trim(), role, parentId });
    const user = await UserDAO.create({
      username: username.trim(),
      secretPhrase: finalPhrase,
      role,
      parentId: parentId || null
    });

    console.log('[Admin] User created successfully:', user.username, 'ID:', user.id);

    // Important: Only return the secret phrase on creation (never again)
    res.status(201).json({
      user: UserDAO.toResponse(user),
      secretPhrase: finalPhrase,
      message: '⚠️ Save this secret phrase somewhere safe - it will not be shown again',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });
  } catch (error: any) {
    console.error('[Admin] Error creating user:', error);
    if (error.message.includes('duplicate')) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
});

/**
 * PUT /api/admin/users/:id
 * 
 * Update user details
 * PROTECTED: Admin only
 * 
 * Body (all optional):
 * - username: string
 * - role: 'admin' | 'parent' | 'child'
 * - parentId: number (for child users)
 * - isActive: boolean
 * 
 * Response:
 * - 200: Updated user
 * - 404: User not found
 * - 403: Not admin
 */
router.put('/admin/users/:id', authenticateJWT, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { username, role, parentId, isActive, secretPhrase } = req.body;

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const user = await UserDAO.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Validate updates
    if (role && !['admin', 'parent', 'child'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (role === 'child' && !parentId) {
      return res.status(400).json({ error: 'Parent ID is required for child users' });
    }

    // Check if new username is unique
    if (username && username !== user.username) {
      const existing = await UserDAO.findByUsername(username);
      if (existing) {
        return res.status(400).json({ error: 'Username already exists' });
      }
    }

    // Update user
    const updates: any = {};
    if (username) updates.username = username;
    if (role) updates.role = role;
    if (parentId) updates.parentId = parentId;
    if (secretPhrase) updates.secretPhrase = secretPhrase;
    if (isActive !== undefined) {
      // Note: Can't directly set isActive via UserDAO.update, would need to add
      // For now, just update other fields
    }

    const updated = await UserDAO.update(userId, updates);
    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(UserDAO.toResponse(updated));
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/**
 * DELETE /api/admin/users/:id
 * 
 * Delete a user (hard delete - removes from database)
 * PROTECTED: Admin only
 * 
 * Response:
 * - 200: { success: true }
 * - 400: Cannot delete - has child users or is last admin
 * - 404: User not found
 * - 403: Not admin
 */
router.delete('/admin/users/:id', authenticateJWT, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id, 10);

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const user = await UserDAO.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deleting the last admin
    if (user.role === 'admin') {
      const admins = (await UserDAO.findAll()).filter(u => u.role === 'admin' && u.isActive);
      if (admins.length <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last admin user' });
      }
    }

    // Check if user has children (if parent)
    if (user.role === 'parent' || user.role === 'admin') {
      const children = await UserDAO.findChildrenByParentId(userId);
      if (children.length > 0) {
        return res.status(400).json({ 
          error: `Cannot delete user with ${children.length} child account(s). Delete or reassign children first.` 
        });
      }
    }

    // Hard delete the user from database
    const connection = await getPool().getConnection();
    try {
      await connection.query('DELETE FROM auth_users WHERE id = ?', [userId]);
      console.log('[Admin] User hard deleted:', user.username, 'ID:', userId);
    } finally {
      connection.release();
    }

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('[Admin] Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

/**
 * GET /api/admin/users/:id/children
 * 
 * Get all children of a parent user
 * PROTECTED: Admin only
 * 
 * Response:
 * - 200: Array of child users
 * - 404: User not found or not a parent
 * - 403: Not admin
 */
router.get('/admin/users/:id/children', authenticateJWT, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id, 10);

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const user = await UserDAO.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role === 'child') {
      return res.status(400).json({ error: 'Child users do not have children' });
    }

    const children = await UserDAO.findChildrenByParentId(userId);

    const response = children.map(UserDAO.toResponse);
    res.json(response);
  } catch (error) {
    console.error('Error getting children:', error);
    res.status(500).json({ error: 'Failed to get children' });
  }
});

/**
 * Generate a random, memorable secret phrase
 * Format: word-word-number-number (e.g., purple-elephant-42-dancing)
 */
function generateRandomPhrase(): string {
  const adjectives = [
    'purple', 'golden', 'silver', 'bright', 'swift', 'gentle', 'strong',
    'quick', 'bold', 'wise', 'happy', 'calm', 'proud', 'kind', 'brave'
  ];

  const nouns = [
    'elephant', 'eagle', 'dragon', 'tiger', 'dolphin', 'phoenix', 'lion',
    'wolf', 'bear', 'fox', 'owl', 'peacock', 'zebra', 'panda', 'butterfly'
  ];

  const verbs = [
    'dancing', 'running', 'flying', 'swimming', 'jumping', 'climbing',
    'singing', 'painting', 'reading', 'writing', 'thinking', 'building'
  ];

  const randomItem = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const randomNum = () => Math.floor(Math.random() * 100);

  return `${randomItem(adjectives)}-${randomItem(nouns)}-${randomNum()}-${randomItem(verbs)}`;
}

export default router;
