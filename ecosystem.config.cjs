module.exports = {
  apps: [
    {
      name: "page-engager",
      script: "npx",
      args: "tsx src/server/index.ts",
      cwd: __dirname,
      env: {
        HEADLESS: "true",
        NODE_ENV: "production",
      },
      // Auto-restart
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      // Logs
      error_file: "data/logs/error.log",
      out_file: "data/logs/out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      // Memory limit — restart if over 512MB
      max_memory_restart: "512M",
      // Watch for crashes
      watch: false,
    },
  ],
};
