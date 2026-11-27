const config = {
  // Isolated verification builds leave the running development app untouched.
  ...(process.env.CODEWILD_BUILD_CHECK === "1" ? { distDir: ".next/level-one-check" } : {}),
  experimental: { cpus: 1, agentUpgrade: "security" },
  // Preserve the internal origin for rewrites; redirects explicitly use Host.
  skipProxyUrlNormalize: true,
  serverExternalPackages: ["mongoose"],
  outputFileTracingIncludes: {
    "/api/pilot": ["./node_modules/@fontsource/rajdhani/files/*-400-normal.woff"],
    "/api/\\[...path\\]": ["./node_modules/@fontsource/rajdhani/files/*-400-normal.woff"],
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/code-studio",
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=()",
          },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default config;
