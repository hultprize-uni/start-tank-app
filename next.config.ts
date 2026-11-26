import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Un segundo `next dev` (pruebas locales) usa su propia carpeta para no corromper la de `pnpm dev`.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
