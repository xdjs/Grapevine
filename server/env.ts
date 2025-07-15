import 'dotenv/config';

/**
 * Environment variable validation utility
 * Ensures all required environment variables are present
 */

interface EnvironmentConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  
  // Database
  DATABASE_URL?: string;
  CONNECTION_STRING?: string;
  
  // Supabase
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  
  // OpenAI
  OPENAI_API_KEY?: string;
  
  // Spotify
  SPOTIFY_CLIENT_ID?: string;
  SPOTIFY_CLIENT_SECRET?: string;
  
  // MusicNerd
  MUSICNERD_BASE_URL_OVERRIDE?: string;
  MUSICNERD_BASE_URL?: string;
  
  // Development
  PORT?: string;
  HOST?: string;
  DEBUG?: string;
  LOG_LEVEL?: string;
  CORS_ORIGIN?: string;
}

function validateEnvironment(): EnvironmentConfig {
  const config: EnvironmentConfig = {
    NODE_ENV: (process.env.NODE_ENV as any) || 'development',
    
    // Database
    DATABASE_URL: process.env.DATABASE_URL,
    CONNECTION_STRING: process.env.CONNECTION_STRING,
    
    // Supabase
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    
    // OpenAI
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    
    // Spotify
    SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
    
    // MusicNerd
    MUSICNERD_BASE_URL_OVERRIDE: process.env.MUSICNERD_BASE_URL_OVERRIDE,
    MUSICNERD_BASE_URL: process.env.MUSICNERD_BASE_URL,
    
    // Development
    PORT: process.env.PORT || '3000',
    HOST: process.env.HOST || 'localhost',
    DEBUG: process.env.DEBUG,
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  };

  // Validate required variables based on environment
  const requiredInProduction = ['DATABASE_URL', 'OPENAI_API_KEY'];
  const requiredInDevelopment = ['CONNECTION_STRING'];
  
  if (config.NODE_ENV === 'production') {
    for (const key of requiredInProduction) {
      if (!config[key as keyof EnvironmentConfig]) {
        console.warn(`⚠️  Missing required environment variable: ${key}`);
      }
    }
  } else {
    for (const key of requiredInDevelopment) {
      if (!config[key as keyof EnvironmentConfig]) {
        console.warn(`⚠️  Missing environment variable: ${key}`);
      }
    }
  }

  return config;
}

// Export validated environment configuration
export const env = validateEnvironment();

// Export individual environment variables for convenience
export const {
  NODE_ENV,
  DATABASE_URL,
  CONNECTION_STRING,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  OPENAI_API_KEY,
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  MUSICNERD_BASE_URL_OVERRIDE,
  MUSICNERD_BASE_URL,
  PORT,
  HOST,
  DEBUG,
  LOG_LEVEL,
  CORS_ORIGIN,
} = env;

// Utility function to check if we're in development
export const isDevelopment = NODE_ENV === 'development';
export const isProduction = NODE_ENV === 'production';
export const isTest = NODE_ENV === 'test';

// Utility function to get database connection string
export const getDatabaseUrl = () => {
  return DATABASE_URL || CONNECTION_STRING || '';
};

// Utility function to check if database is configured
export const isDatabaseConfigured = () => {
  return !!(DATABASE_URL || CONNECTION_STRING);
};

// Utility function to check if OpenAI is configured
export const isOpenAIConfigured = () => {
  return !!OPENAI_API_KEY;
};

// Utility function to check if Spotify is configured
export const isSpotifyConfigured = () => {
  return !!(SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET);
};

// Utility function to check if Supabase is configured
export const isSupabaseConfigured = () => {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
};

console.log('🔧 Environment configuration loaded:', {
  NODE_ENV,
  isDatabaseConfigured: isDatabaseConfigured(),
  isOpenAIConfigured: isOpenAIConfigured(),
  isSpotifyConfigured: isSpotifyConfigured(),
  isSupabaseConfigured: isSupabaseConfigured(),
}); 