module.exports = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD
  },
  port: parseInt(process.env.PORT) || 3000,
  github: {
    // Add any GitHub-related config here
  }
}; 