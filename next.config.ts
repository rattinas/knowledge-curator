import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "pdfkit", "node-telegram-bot-api"],
  turbopack: {},
};

export default nextConfig;
