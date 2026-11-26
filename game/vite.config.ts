import { defineConfig } from "vite";

// The rig sources live in ../rigging (kept as delivered); let the dev server read them.
export default defineConfig({
  server: { fs: { allow: [".."] } },
});
