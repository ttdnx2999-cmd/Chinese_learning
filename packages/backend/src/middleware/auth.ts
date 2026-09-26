/**
 * Authentication Middleware
 * 
 * Express middleware for JWT validation and role-based access control.
 */

import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { JWTPayload, UserRole } from '../models/User';

/**
 * Extended Express Request with user info
 */
export interface AuthRequest extends Request {
  user?: JWTPayload;
}

/**
 * Middleware to extract and validate JWT from Authorization header
 */
export function authenticateJWT(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  const payload = AuthService.verifyToken(token);

  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = payload;
  next();
}

/**
 * Middleware to check if user has required roles
 * @param allowedRoles - Array of allowed roles
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Access denied. Required roles: ${allowedRoles.join(', ')}. Your role: ${req.user.role}` 
      });
    }

    next();
  };
}

/**
 * Middleware to ensure user is accessing their own data or is admin
 * Checks if the requested user_id matches authenticated user_id, or user is admin
 */
export function canAccessUser(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const requestedUserId = req.params.userId ? parseInt(req.params.userId, 10) : null;

  if (!requestedUserId) {
    return res.status(400).json({ error: 'User ID parameter is required' });
  }

  // Allow access if user is admin or if it's their own user_id
  if (req.user.role === 'admin' || req.user.userId === requestedUserId) {
    next();
  } else {
    return res.status(403).json({ error: 'Access denied' });
  }
}

/**
 * Middleware to ensure parent can access only their own children
 * or user is accessing their own account
 */
export function canAccessChildData(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const requestedUserId = req.params.userId ? parseInt(req.params.userId, 10) : null;

  if (!requestedUserId) {
    return res.status(400).json({ error: 'User ID parameter is required' });
  }

  // Admin can access anything
  if (req.user.role === 'admin') {
    return next();
  }

  // User can access their own data
  if (req.user.userId === requestedUserId) {
    return next();
  }

  // Parent can access their children's data
  if (req.user.role === 'parent' && req.user.parentId === null) {
    // This is a real parent, they can access children
    // The actual check for "is this their child" happens in the route handler
    return next();
  }

  return res.status(403).json({ error: 'Access denied' });
}

/**
 * Optional JWT - doesn't fail if token is missing, but validates if present
 */
export function optionalJWT(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = AuthService.verifyToken(token);

    if (payload) {
      req.user = payload;
    }
  }

  next();
}
