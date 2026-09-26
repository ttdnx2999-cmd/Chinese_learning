/**
 * Authentication API Routes
 * 
 * Provides REST API endpoints for user authentication:
 * - POST /api/auth/login - Authenticate with username and secret phrase
 * - POST /api/auth/register - Create new user (admin only)
 * - GET /api/auth/me - Get current user info (requires authentication)
 * - GET /api/auth/verify - Verify JWT token
 */

import { Router, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { UserDAO } from '../models/User';
import { authenticateJWT, AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

// Temporary, explicitly enabled password-free entry for testing.
router.post('/auth/admin-test', async (_req, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  if (process.env.ENABLE_TEMP_ADMIN_ACCESS !== 'true') {
    return res.status(404).json({ error: 'Temporary admin access is disabled' });
  }
  try {
    const user = await UserDAO.findByUsername('admin');
    if (!user || !user.isActive || user.role !== 'admin') {
      return res.status(503).json({ error: 'The admin account is unavailable' });
    }
    return res.json({
      success: true, user: UserDAO.toResponse(user),
      token: AuthService.generateTemporaryAdminToken(user), expiresIn: 3600
    });
  } catch (error) {
    console.error('Temporary admin login failed:', error);
    return res.status(500).json({ error: 'Temporary admin login failed' });
  }
});

/**
 * POST /api/auth/login
 * 
 * Authenticate user with username and secret phrase
 * 
 * Body:
 * - username: string (required)
 * - secretPhrase: string (required)
 * 
 * Response:
 * - 200: { user, token, expiresIn }
 * - 400: Invalid input
 * - 401: Invalid credentials
 * - 500: Server error
 */
router.post('/auth/login', async (req: AuthRequest, res: Response) => {
  try {
    const { username, secretPhrase } = req.body;

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Username is required' });
    }

    if (!secretPhrase || typeof secretPhrase !== 'string') {
      return res.status(400).json({ error: 'Secret phrase is required' });
    }

    // Find user by username
    const user = await UserDAO.findByUsername(username);
    
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid username or secret phrase' });
    }

    // Verify secret phrase
    const isValid = await UserDAO.verifySecretPhrase(secretPhrase, user.secretPhraseHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid username or secret phrase' });
    }

    // Generate token
    const token = AuthService.generateToken(user);

    res.json({
      success: true,
      user: UserDAO.toResponse(user),
      token,
      expiresIn: 2592000 // 30 days in seconds
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/auth/login-by-phrase
 * 
 * Authenticate user by secret phrase only (simplified UX)
 * Finds user by secret phrase hash and returns their info with token
 * 
 * Body:
 * - secretPhrase: string (required)
 * 
 * Response:
 * - 200: { user, token, expiresIn }
 * - 400: Invalid input
 * - 401: Invalid secret phrase
 * - 500: Server error
 */
router.post('/auth/login-by-phrase', async (req: AuthRequest, res: Response) => {
  try {
    const { secretPhrase } = req.body;

    if (!secretPhrase || typeof secretPhrase !== 'string') {
      return res.status(400).json({ error: 'Secret phrase is required' });
    }

    // Find all users and check their secret phrase
    const allUsers = await UserDAO.findAll();
    let matchedUser = null;

    for (const user of allUsers) {
      if (user.isActive) {
        const isValid = await UserDAO.verifySecretPhrase(secretPhrase, user.secretPhraseHash);
        if (isValid) {
          matchedUser = user;
          break;
        }
      }
    }

    if (!matchedUser) {
      return res.status(401).json({ error: 'Invalid secret phrase' });
    }

    // Generate token
    const token = AuthService.generateToken(matchedUser);

    res.json({
      success: true,
      user: UserDAO.toResponse(matchedUser),
      token,
      expiresIn: 2592000 // 30 days in seconds
    });
  } catch (error) {
    console.error('Error during login by phrase:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
  try {
    const { username, secretPhrase } = req.body;

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Username is required' });
    }

    if (!secretPhrase || typeof secretPhrase !== 'string') {
      return res.status(400).json({ error: 'Secret phrase is required' });
    }

    const result = await AuthService.authenticate(username, secretPhrase);

    if (!result) {
      return res.status(401).json({ error: 'Invalid username or secret phrase' });
    }

    res.json({
      success: true,
      user: result.user,
      token: result.token,
      expiresIn: 2592000 // 30 days in seconds
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/auth/register
 * 
 * Create a new user (admin only)
 * 
 * Body:
 * - username: string (required)
 * - secretPhrase: string (required)
 * - role: 'admin' | 'parent' | 'child' (optional, default: 'parent')
 * - parentId: number (required for child users)
 * 
 * Response:
 * - 201: { success, user, token }
 * - 400: Invalid input or username exists
 * - 401: Unauthorized (not admin)
 * - 500: Server error
 */
router.post('/auth/register', authenticateJWT, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { username, secretPhrase, role = 'parent', parentId } = req.body;

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Username is required' });
    }

    if (!secretPhrase || typeof secretPhrase !== 'string') {
      return res.status(400).json({ error: 'Secret phrase is required' });
    }

    if (role && !['admin', 'parent', 'child'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (role === 'child' && !parentId) {
      return res.status(400).json({ error: 'Parent ID is required for child users' });
    }

    try {
      const user = await AuthService.register(username, secretPhrase, role, parentId);
      const token = AuthService.generateToken(user);

      res.status(201).json({
        success: true,
        user: UserDAO.toResponse(user),
        token
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * GET /api/auth/me
 * 
 * Get current authenticated user info
 * 
 * Response:
 * - 200: User object
 * - 401: Unauthorized
 * - 500: Server error
 */
router.get('/auth/me', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await UserDAO.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(UserDAO.toResponse(user));
  } catch (error) {
    console.error('Error getting current user:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

/**
 * GET /api/auth/verify
 * 
 * Verify JWT token validity without authenticating full request
 * Useful for frontend to check token expiry
 * 
 * Query params:
 * - token: string (JWT token to verify)
 * 
 * Response:
 * - 200: { valid: true, user }
 * - 200: { valid: false }
 */
router.get('/auth/verify', async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.json({ valid: false });
    }

    const payload = AuthService.verifyToken(token);

    if (!payload) {
      return res.json({ valid: false });
    }

    const user = await UserDAO.findById(payload.userId);

    if (!user || !user.isActive) {
      return res.json({ valid: false });
    }

    res.json({
      valid: true,
      user: UserDAO.toResponse(user)
    });
  } catch (error) {
    console.error('Error verifying token:', error);
    res.json({ valid: false });
  }
});

/**
 * POST /api/auth/logout
 * 
 * Logout (client-side: delete token from localStorage)
 * This endpoint just confirms logout was requested
 * 
 * Response:
 * - 200: { success: true }
 */
router.post('/auth/logout', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    // Logout is handled client-side by deleting the token
    // This endpoint is just for confirmation/logging
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

export default router;
