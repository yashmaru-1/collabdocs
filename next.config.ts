import type { NextConfig } from "next";

const isElectronBuild = process.env.ELECTRON_BUILD === "1";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Static export for Electron production packaging
  // Set ELECTRON_BUILD=1 before `next build` to enable
  ...(isElectronBuild && {
    output: "export",
    // Disable image optimization for static export
    images: { unoptimized: true },
  }),
};

export default nextConfig;
