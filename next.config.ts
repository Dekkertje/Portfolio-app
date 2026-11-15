import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  // Oude pagina's lazen de legacy-tabellen; alles loopt nu via het grootboek
  async redirects() {
    return [
      { source: "/dashboard", destination: "/overzicht", permanent: false },
      { source: "/dashboard/dividenden", destination: "/dividend", permanent: false },
      { source: "/dashboard/gesloten", destination: "/posities", permanent: false },
      { source: "/dashboard/position", destination: "/posities", permanent: false },
      { source: "/dashboard/tickers", destination: "/posities", permanent: false },
      { source: "/transactions", destination: "/transacties", permanent: false },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'sfgjlhjegqpdbiubozuk.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
