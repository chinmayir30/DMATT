import pool from './src/config/database.js';
import bcrypt from 'bcryptjs';

const updatePasswords = async () => {
  try {
    const password = process.env.DEFAULT_USER_PASSWORD || 'password123';
    const validHash = await bcrypt.hash(password, 10);

    console.log(`Updating user passwords with bcrypt hash for '${password}'...`);
    const result = await pool.query(
      'UPDATE users SET password_hash = $1',
      [validHash]
    );
    
    console.log(`Successfully updated ${result.rowCount} users.`);
  } catch (error) {
    console.error('Error updating passwords:', error);
  } finally {
    pool.end();
  }
};

updatePasswords();
