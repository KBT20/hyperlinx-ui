module.exports = {
  apps: [
    {
      name: "teralinx-runtime",
      script: "server/index.js",
      cwd: __dirname,
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        PORT: "3001",
        DAL_ENV: "Production",
      },
    },
  ],
};
