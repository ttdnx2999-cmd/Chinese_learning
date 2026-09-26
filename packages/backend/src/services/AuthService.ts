/**
 * Authentication Service
 * 
 * Handles JWT token generation, validation, and user authentication logic.
 */

import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { UserDAO, User, JWTPayload, UserResponse } from '../models/User';

export class AuthService {
  /**
   * Generate JWT token for a user
   * @param user - User object
   * @returns JWT token
   */
  static generateToken(user: User): string {
    const payload: JWTPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      parentId: user.parentId
    };

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: '30d' // Token valid for 30 days
    });
  }

  /**
   * Verify and decode JWT token
   * @param token - JWT token
   * @returns Decoded payload or null if invalid
   */
  static verifyToken(token: string): JWTPayload | null {
    try {
      const payload = jwt.verify(token, config.jwt.secret) as JWTPayload;
      if (payload.temporaryAdmin && process.env.ENABLE_TEMP_ADMIN_ACCESS !== 'true') return null;
      return payload;
    } catch (error) {
      return null;
    }
  }

  static generateTemporaryAdminToken(user: User): string {
    return jwt.sign({
      userId: user.id, username: user.username, role: user.role,
      parentId: user.parentId, temporaryAdmin: true
    }, config.jwt.secret, { expiresIn: '1h' });
  }

  /**
   * Authenticate user with username and secret phrase
   * @param username - Username
   * @param secretPhrase - Secret phrase
   * @returns User and token on success, null on failure
   */
  static async authenticate(
    username: string,
    secretPhrase: string
  ): Promise<{ user: UserResponse; token: string } | null> {
    // Find user by username
    const user = await UserDAO.findByUsername(username);

    if (!user || !user.isActive) {
      return null;
    }

    // Verify secret phrase
    const isValid = await UserDAO.verifySecretPhrase(secretPhrase, user.secretPhraseHash);

    if (!isValid) {
      return null;
    }

    // Generate token
    const token = this.generateToken(user);

    return {
      user: UserDAO.toResponse(user),
      token
    };
  }

  /**
   * Register a new user (admin only)
   * @param username - Username
   * @param secretPhrase - Secret phrase
   * @param role - User role
   * @param parentId - Parent ID for child users
   * @returns Created user
   */
  static async register(
    username: string,
    secretPhrase: string,
    role: 'admin' | 'parent' | 'child' = 'parent',
    parentId?: number
  ): Promise<User> {
    // Check if username already exists
    const existing = await UserDAO.findByUsername(username);
    if (existing) {
      throw new Error('Username already exists');
    }

    // Validate parent_id for child users
    if (role === 'child' && !parentId) {
      throw new Error('Parent ID is required for child users');
    }

    // Create user
    return UserDAO.create({
      username,
      secretPhrase,
      role,
      parentId: parentId || null
    });
  }

  /**
   * Decode token without verification (for debugging)
   * @param token - JWT token
   * @returns Decoded payload or null
   */
  static decodeToken(token: string): JWTPayload | null {
    try {
      return jwt.decode(token) as JWTPayload;
    } catch (error) {
      return null;
    }
  }
}
