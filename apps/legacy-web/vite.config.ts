import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      assets: path.resolve(__dirname, "src/assets"),
      components: path.resolve(__dirname, "src/components"),
      hooks: path.resolve(__dirname, "src/hooks"),
      types: path.resolve(__dirname, "src/types"),
      utils: path.resolve(__dirname, "src/utils"),
      security: path.resolve(__dirname, "src/security"),
      pages: path.resolve(__dirname, "src/pages"),
      classroom: path.resolve(__dirname, "src/pages/classrooms"),
      dash: path.resolve(__dirname, "src/pages/Dashboard"),
      forgot: path.resolve(__dirname, "src/pages/ForgotPassword"),
      home: path.resolve(__dirname, "src/pages/Home"),
      login: path.resolve(__dirname, "src/pages/Login"),
      notFound: path.resolve(__dirname, "src/pages/NotFound"),
      roleSelect: path.resolve(__dirname, "src/pages/RoleSelect"),
      signup: path.resolve(__dirname, "src/pages/Signup"),
    },
  },
});
