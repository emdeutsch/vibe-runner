/**
 * Supabase JWT authentication middleware for Hono
 */

import { Context, Next } from 'hono';
import { createClient, User } from '@supabase/supabase-js';
import { config } from '../config.js';

// Create Supabase client
const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

// Extend Hono context with user
declare module 'hono' {
  interface ContextVariableMap {
    user: User;
    userId: string;
  }
}

/**
 * Auth middleware - verifies Supabase JWT and sets user in context
 */
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.substring(7);

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    // Set user in context
    c.set('user', user);
    c.set('userId', user.id);

    await next();
  } catch (error) {
    console.error('Auth error:', error);
    return c.json({ error: 'Authentication failed' }, 401);
  }
}

/**
 * Optional auth middleware - sets user if present but doesn't require it
 */
export async function optionalAuthMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    try {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        c.set('user', user);
        c.set('userId', user.id);
      }
    } catch {
      // Ignore auth errors for optional auth
    }
  }

  await next();
}
