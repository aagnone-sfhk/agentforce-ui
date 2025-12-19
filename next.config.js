/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        hostname: "wp.salesforce.com",
      },
      {
        hostname: "b2b.herokuapps.ai",
      },
      {
        hostname: "b2b.commerce.butpurple.com",
      },
    ],
  },
  experimental: {
    useCache: true,
    cacheLife: {
      blog: {
        stale: 60 * 10,
        revalidate: 60 * 10,
        expire: 60 * 10,
      },
    },
  },
  // Exclude applink SDK from bundling - it uses pino with native transports
  serverExternalPackages: ["@heroku/applink", "pino", "pino-pretty"],
};

export default nextConfig;
