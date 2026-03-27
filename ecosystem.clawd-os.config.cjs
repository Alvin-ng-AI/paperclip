module.exports = {
  apps: [{
    name: "clawd-os",
    script: "/home/claudeuser/clawd/start-clawd-os.sh",
    cwd: "/home/claudeuser/clawd/paperclip/server",
    env: {
      PORT: "18794",
      SERVE_UI: "true",
      PAPERCLIP_CONFIG: "/home/claudeuser/.paperclip/instances/default/config.json",
      PAPERCLIP_DEPLOYMENT_MODE: "authenticated",
      PAPERCLIP_DEPLOYMENT_EXPOSURE: "public",
      PAPERCLIP_PUBLIC_URL: "http://178.128.212.222:18794",
      BETTER_AUTH_SECRET: "clawd-os-instance-secret-2026",
      DATABASE_URL: "postgresql://paperclip:paperclip123@127.0.0.1:5432/paperclip"
    }
  }]
};
