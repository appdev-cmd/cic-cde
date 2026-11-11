import { fileURLToPath } from "node:url";
import { defineConfig, normalizePath } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";

const localPath = (path: string) => normalizePath(fileURLToPath(new URL(path, import.meta.url)));
const cadPackage = "../cad-viewer/node_modules/@mlightcad/";

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: localPath(cadPackage + "cad-simple-viewer/dist/mtext-renderer-worker.js"),
          dest: "cad-assets",
        },
        {
          src: localPath(cadPackage + "libredwg-converter/dist/{libredwg-parser-worker.js,libredwg-web.wasm}"),
          dest: "cad-assets",
        },
        {
          src: localPath(cadPackage + "libredwg-converter/LICENSE"),
          dest: "cad-assets",
          rename: "libredwg-LICENSE.txt",
        },
      ],
    }),
  ],
  server: { port: 1420, strictPort: true },
  build: {
    rollupOptions: {
      input: {
        main: localPath("./index.html"),
        cad: localPath("./cad-viewer.html"),
      },
      output: {
        manualChunks: {
          three: ["three", "three/addons/controls/OrbitControls.js"],
          react: ["react", "react-dom"],
        },
      },
    },
  },
  clearScreen: false,
});
