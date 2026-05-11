/**
 * Authentication Controller
 * Handles user authentication and JWT token generation
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';

/**
 * Login user and generate JWT token
 * POST /api/auth/login
 *
 * Request body:
 * - email: string (required)
 * - password: string (required)
 *
 * Response:
 * - token: JWT token string
 * - user: { id, email, name, role }
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email and password are required',
        error: {
          code: 'VALIDATION_ERROR',
          fields: {
            email: !email ? 'Email is required' : undefined,
            password: !password ? 'Password is required' : undefined
          }
        }
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid email format',
        error: {
          code: 'VALIDATION_ERROR',
          fields: {
            email: 'Invalid email format'
          }
        }
      });
    }

    // Find user by email
    const result = await pool.query(
      'SELECT id, email, name, password_hash, role FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password',
        error: {
          code: 'INVALID_CREDENTIALS'
        }
      });
    }

    const user = result.rows[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password',
        error: {
          code: 'INVALID_CREDENTIALS'
        }
      });
    }

    // Generate JWT token (24 hour expiration)
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      jwtSecret,
      {
        expiresIn: '24h',
        issuer: 'dmat-api',
        audience: 'dmat-client'
      }
    );

    // Update last login timestamp
    await pool.query(
      'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Return success response with token and user data
    return res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    const code = error.code;
    const msg = String(error.message || '');
    const isDbAuth =
      code === '28P01' || msg.includes('password authentication failed');
    const isDbConn =
      code === 'ECONNREFUSED' ||
      code === 'ENOTFOUND' ||
      code === '3D000' ||
      msg.includes('ECONNREFUSED') ||
      (msg.includes('does not exist') && msg.toLowerCase().includes('database'));

    let message = 'An error occurred during login';
    if (isDbAuth) {
      message =
        'Database rejected the login (wrong DB password). In backend/.env set DB_PASSWORD to your PostgreSQL password for user DB_USER, then restart the server.';
    } else if (isDbConn) {
      message =
        'Cannot reach PostgreSQL. Start the database service and ensure DB_HOST, DB_PORT, and DB_NAME in backend/.env are correct, then restart the server.';
    }

    return res.status(500).json({
      status: 'error',
      message,
      error: {
        code: isDbAuth || isDbConn ? 'DATABASE_ERROR' : 'INTERNAL_ERROR',
      },
    });
  }
};

/**
 * Verify JWT token (for testing purposes)
 * GET /api/auth/verify
 *
 * Requires: Authorization header with Bearer token
 *
 * Response:
 * - valid: boolean
 * - user: decoded token data
 */
export const verifyToken = async (req, res) => {
  try {
    // Token is already verified by auth middleware
    // This endpoint just confirms the token is valid
    return res.status(200).json({
      status: 'success',
      message: 'Token is valid',
      data: {
        valid: true,
        user: {
          id: req.user.userId,
          email: req.user.email,
          role: req.user.role
        }
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred during token verification',
      error: {
        code: 'INTERNAL_ERROR'
      }
    });
  }
};
