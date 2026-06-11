import React, { createContext, useContext, useState, useEffect } from 'react';
import { getDB, getSetting, setSetting } from '../database/db';
import { hashPassword, generateSalt } from '../utils/crypto';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: { username: string } | null;
  login: (username: string, password: string, remember: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  changePassword: (oldPass: string, newPass: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<{ username: string } | null>(null);

  useEffect(() => {
    async function checkAutoLogin() {
      try {
        const rememberSetting = await getSetting('remember_login', 'false');
        if (rememberSetting === 'true') {
          const savedUser = await getSetting('remembered_user', '');
          const savedPass = await getSetting('remembered_password', '');
          if (savedUser && savedPass) {
            const db = await getDB();
            const dbUser = await db.getFirstAsync<{ id: number; username: string; password_hash: string; salt: string }>(
              'SELECT * FROM users WHERE username = ?;',
              [savedUser.trim()]
            );

            if (dbUser) {
              const computedHash = await hashPassword(savedPass, dbUser.salt);
              if (computedHash === dbUser.password_hash) {
                setUser({ username: dbUser.username });
                setIsAuthenticated(true);
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to auto-login:', error);
      } finally {
        setIsLoading(false);
      }
    }
    checkAutoLogin();
  }, []);

  const login = async (username: string, password: string, remember: boolean): Promise<{ success: boolean; error?: string }> => {
    try {
      const db = await getDB();
      const dbUser = await db.getFirstAsync<{ id: number; username: string; password_hash: string; salt: string }>(
        'SELECT * FROM users WHERE username = ?;',
        [username.trim()]
      );

      if (!dbUser) {
        return { success: false, error: 'Incorrect username or password' };
      }

      // Hash the entered password with the user's salt
      const computedHash = await hashPassword(password, dbUser.salt);

      if (computedHash !== dbUser.password_hash) {
        return { success: false, error: 'Incorrect username or password' };
      }

      // Successful login
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      await db.runAsync('UPDATE users SET last_login = ? WHERE id = ?;', [timestamp, dbUser.id]);

      if (remember) {
        await setSetting('remember_login', 'true');
        await setSetting('remembered_user', dbUser.username);
        await setSetting('remembered_password', password);
      } else {
        await setSetting('remember_login', 'false');
        await setSetting('remembered_user', '');
        await setSetting('remembered_password', '');
      }

      setUser({ username: dbUser.username });
      setIsAuthenticated(true);
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Database error occurred' };
    }
  };

  const logout = async () => {
    try {
      await setSetting('remember_login', 'false');
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const changePassword = async (oldPass: string, newPass: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!user) return { success: false, error: 'User not logged in' };
      const db = await getDB();
      
      const dbUser = await db.getFirstAsync<{ id: number; password_hash: string; salt: string }>(
        'SELECT * FROM users WHERE username = ?;',
        [user.username]
      );

      if (!dbUser) {
        return { success: false, error: 'User not found' };
      }

      const computedOldHash = await hashPassword(oldPass, dbUser.salt);
      if (computedOldHash !== dbUser.password_hash) {
        return { success: false, error: 'Old password is incorrect' };
      }

      // Generate a new salt and hash the new password
      const newSalt = generateSalt();
      const newHash = await hashPassword(newPass, newSalt);

      await db.runAsync(
        'UPDATE users SET password_hash = ?, salt = ? WHERE id = ?;',
        [newHash, newSalt, dbUser.id]
      );

      return { success: true };
    } catch (error) {
      console.error('Change password error:', error);
      return { success: false, error: 'Database error occurred' };
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, login, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
