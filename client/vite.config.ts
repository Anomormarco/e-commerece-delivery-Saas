import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const entriesByMode = {
  public: "/src/apps/public/main.tsx",
  admin: "/src/apps/admin/main.tsx",
  store: "/src/apps/store/main.tsx",
  courier: "/src/apps/courier/main.tsx",
  customer: "/src/apps/customer/main.tsx",
};

export default defineConfig(({ mode }) => {
  const entry = entriesByMode[mode as keyof typeof entriesByMode] ?? entriesByMode.public;

  return {
    plugins: [
      react(),
      {
        name: "deliverhub-role-entry",
        transformIndexHtml: {
          order: "pre",
          handler(html) {
            return html.replace(entriesByMode.public, entry);
          },
        },
      },
    ],
    server: {
      port: 5173,
      strictPort: true,
    },
  };
});
