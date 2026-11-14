const config = {
  // Isolated verification builds leave the running development app untouched.
  ...(process.env.CODEWILD_BUILD_CHECK === "1" ? { distDir: ".next/level-one-check" } : {}),
  experimental: { cpus: 1 },
  serverExternalPackages: ["mongoose"],
  outputFileTracingIncludes: {
    "/api/pilot": ["./node_modules/@fontsource/rajdhani/files/*-400-normal.woff"],
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=()",
          },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default config;
