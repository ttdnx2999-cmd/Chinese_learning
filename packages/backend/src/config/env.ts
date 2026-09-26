export const config = {
  database: {
    get host() { return process.env.DB_HOST || 'localhost'; },
    get port() { return parseInt(process.env.DB_PORT || '3306'); },
    get user() { return process.env.DB_USER || 'root'; },
    get password() { return process.env.DB_PASSWORD || ''; },
    get name() { return process.env.DB_NAME || 'chinese_learning_app'; }
  },
  google: {
    get translateApiKey() { return process.env.GOOGLE_TRANSLATE_API_KEY || ''; },
    get aiApiKey() { return process.env.GOOGLE_AI_API_KEY || ''; }
  },
  server: {
    get port() { return parseInt(process.env.PORT || '3000'); },
    get nodeEnv() { return process.env.NODE_ENV || 'development'; }
  },
  admin: {
    get password() { return process.env.ADMIN_PASSWORD || ''; }
  },
  jwt: {
    get secret() { 
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new Error('JWT_SECRET is not set in environment variables');
      }
      return secret;
    }
  }
};

export function validateConfig() {
  const errors: string[] = [];

  if (!config.google.translateApiKey) {
    errors.push('GOOGLE_TRANSLATE_API_KEY is not set');
  }

  if (!config.google.aiApiKey) {
    errors.push('GOOGLE_AI_API_KEY is not set');
  }

  if (!config.database.password && config.server.nodeEnv === 'production') {
    errors.push('DB_PASSWORD should be set in production');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
