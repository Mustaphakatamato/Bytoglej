/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'fhnizihpdensqfdpgcgn.supabase.co' },
    ],
  },
};

module.exports = nextConfig;
