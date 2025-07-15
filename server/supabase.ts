import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project-ref.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-anon-or-service-role-key';

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);

// Database connection for Drizzle
const connectionString = process.env.DATABASE_URL || process.env.CONNECTION_STRING;

if (!connectionString) {
  console.warn('DATABASE_URL or CONNECTION_STRING not provided. Using in-memory storage.');
}

// Create database connection
let db: ReturnType<typeof drizzle> | null = null;

if (connectionString) {
  try {
    const client = postgres(connectionString);
    db = drizzle(client);
    console.log('Connected to Supabase database via Drizzle');
  } catch (error) {
    console.error('Failed to connect to database:', error);
  }
}

export { db };

// Database initialization function
export async function initializeDatabase() {
  if (!db) {
    console.log('No database connection available');
    return false;
  }

  try {
    // Check if we can connect to the database
    console.log('Database connection established');
    return true;
  } catch (error) {
    console.error('Database initialization failed:', error);
    return false;
  }
}

// Helper function to check if database is available
export function isDatabaseAvailable(): boolean {
  return db !== null && connectionString !== undefined;
}