import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function pickEnv(env, key) {
  return env[`VITE_${key}`] || env[`REACT_APP_${key}`] || "";
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: 3000,
    },
    build: {
      outDir: "build",
      emptyOutDir: true,
    },
    define: {
      "process.env.NODE_ENV": JSON.stringify(mode),
      "process.env.PUBLIC_URL": JSON.stringify(""),
      "process.env.REACT_APP_API_BASE_URL": JSON.stringify(pickEnv(env, "API_BASE_URL")),
      "process.env.REACT_APP_SUPABASE_URL": JSON.stringify(pickEnv(env, "SUPABASE_URL")),
      "process.env.REACT_APP_SUPABASE_ANON_KEY": JSON.stringify(pickEnv(env, "SUPABASE_ANON_KEY")),
      "process.env.REACT_APP_SUPABASE_REDIRECT_URL": JSON.stringify(pickEnv(env, "SUPABASE_REDIRECT_URL")),
      "process.env.REACT_APP_TERMS_URL": JSON.stringify(pickEnv(env, "TERMS_URL")),
      "process.env.REACT_APP_PRIVACY_POLICY_URL": JSON.stringify(pickEnv(env, "PRIVACY_POLICY_URL")),
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.js"],
      clearMocks: true,
      restoreMocks: true,
      css: true,
    },
  };
});
