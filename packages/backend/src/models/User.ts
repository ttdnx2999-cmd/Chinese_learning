/**
 * User Model
 * 
 * TypeScript interfaces and data access layer for user authentication and role management.
 * Implements CRUD operations with role-based access control.
 */

import { getPool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

/**
 * User role types
 */
export type UserRole = 'admin' | 'parent' | 'child';

/**
 * Input interface for creating a user
 */
export interface UserInput {
  username: string;
  secretPhrase: string;
  role: UserRole;
  parentId?: number | null;
}

/**
 * Complete user interface matching database schema
 */
export interface User {
  id: number;
  username: string;
  secretPhraseHash: string;
  role: UserRole;
  parentId: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User response interface (without sensitive data)
 */
export interface UserResponse {
  id: number;
  username: string;
  role: UserRole;
  parentId: number | null;
  isActive: boolean;
  createdAt: Date;
}

/**
 * JWT payload interface
 */
export interface JWTPayload {
  temporaryAdmin?: boolean;
  userId: number;
  username: string;
  role: UserRole;
  parentId: number | null;
}

/**
 * Database row interface for type-safe queries
 */
interface UserRow extends RowDataPacket {
  id: number;
  username: string;
  secret_phrase_hash: string;
  role: UserRole;
  parent_id: number | null;
  is_active: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Convert database row to User interface
 */
function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    secretPhraseHash: row.secret_phrase_hash,
    role: row.role,
    parentId: row.parent_id,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Convert User to response interface (without secret hash)
 */
function userToResponse(user: User): UserResponse {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    parentId: user.parentId,
    isActive: user.isActive,
    createdAt: user.createdAt
  };
}

/**
 * Data Access Layer for User
 */
export class UserDAO {
  /**
   * Hash a secret phrase
   * @param secretPhrase - Plain text secret phrase
   * @returns Hashed secret phrase
   */
  static async hashSecretPhrase(secretPhrase: string): Promise<string> {
    return bcrypt.hash(secretPhrase, 10);
  }

  /**
   * Verify a secret phrase against its hash
   * @param secretPhrase - Plain text secret phrase
   * @param hash - Hashed secret phrase
   * @returns True if matches
   */
  static async verifySecretPhrase(secretPhrase: string, hash: string): Promise<boolean> {
    return bcrypt.compare(secretPhrase, hash);
  }

  /**
   * Create a new user
   * @param input - User input data
   * @returns Created user
   */
  static async create(input: UserInput): Promise<User> {
    const pool = getPool();
    
    // Hash the secret phrase
    const secretPhraseHash = await this.hashSecretPhrase(input.secretPhrase);
    
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO auth_users (username, secret_phrase_hash, role, parent_id, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [
        input.username,
        secretPhraseHash,
        input.role,
        input.parentId || null,
        1
      ]
    );

    // Fetch and return the created user
    const created = await this.findById(result.insertId);
    if (!created) {
      throw new Error('Failed to create user');
    }
    
    return created;
  }

  /**
   * Find user by ID
   * @param id - User ID
   * @returns User or null if not found
   */
  static async findById(id: number): Promise<User | null> {
    const pool = getPool();
    
    const [rows] = await pool.query<UserRow[]>(
      `SELECT * FROM auth_users WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return null;
    }

    return rowToUser(rows[0]);
  }

  /**
   * Find user by username
   * @param username - Username
   * @returns User or null if not found
   */
  static async findByUsername(username: string): Promise<User | null> {
    const pool = getPool();
    
    const [rows] = await pool.query<UserRow[]>(
      `SELECT * FROM auth_users WHERE username = ?`,
      [username]
    );

    if (rows.length === 0) {
      return null;
    }

    return rowToUser(rows[0]);
  }

  /**
   * Get all users (for admin)
   * @returns Array of users
   */
  static async findAll(): Promise<User[]> {
    const pool = getPool();
    
    const [rows] = await pool.query<UserRow[]>(
      `SELECT * FROM auth_users ORDER BY created_at DESC`
    );

    return rows.map(rowToUser);
  }

  /**
   * Get children of a parent user
   * @param parentId - Parent user ID
   * @returns Array of child users
   */
  static async findChildrenByParentId(parentId: number): Promise<User[]> {
    const pool = getPool();
    
    const [rows] = await pool.query<UserRow[]>(
      `SELECT * FROM auth_users WHERE parent_id = ? ORDER BY created_at ASC`,
      [parentId]
    );

    return rows.map(rowToUser);
  }

  /**
   * Update user
   * @param id - User ID
   * @param updates - Partial updates
   * @returns Updated user or null if not found
   */
  static async update(
    id: number,
    updates: Partial<Omit<UserInput, 'secretPhrase'> & { secretPhrase?: string }>
  ): Promise<User | null> {
    const pool = getPool();
    
    const updateFields: string[] = [];
    const params: any[] = [];

    if (updates.username !== undefined) {
      updateFields.push('username = ?');
      params.push(updates.username);
    }
    if (updates.secretPhrase !== undefined) {
      const hash = await this.hashSecretPhrase(updates.secretPhrase);
      updateFields.push('secret_phrase_hash = ?');
      params.push(hash);
    }
    if (updates.role !== undefined) {
      updateFields.push('role = ?');
      params.push(updates.role);
    }
    if (updates.parentId !== undefined) {
      updateFields.push('parent_id = ?');
      params.push(updates.parentId || null);
    }

    if (updateFields.length === 0) {
      return this.findById(id);
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const query = `UPDATE auth_users SET ${updateFields.join(', ')} WHERE id = ?`;

    const [result] = await pool.query<ResultSetHeader>(query, params);

    if (result.affectedRows === 0) {
      return null;
    }

    return this.findById(id);
  }

  /**
   * Deactivate user (soft delete)
   * @param id - User ID
   * @returns True if deactivated, false if not found
   */
  static async deactivate(id: number): Promise<boolean> {
    const pool = getPool();
    
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE auth_users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );

    return result.affectedRows > 0;
  }

  /**
   * Check if username exists
   * @param username - Username to check
   * @returns True if exists
   */
  static async usernameExists(username: string): Promise<boolean> {
    const pool = getPool();
    
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM auth_users WHERE username = ? LIMIT 1`,
      [username]
    );

    return rows.length > 0;
  }

  /**
   * Convert user to response (without sensitive data)
   */
  static toResponse(user: User): UserResponse {
    return userToResponse(user);
  }
}
