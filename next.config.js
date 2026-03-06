/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  webpack: (config) => {
    // react-pdf / pdfjs-dist optionally requires 'canvas' (node-only). Ignore it in the browser bundle.
    config.resolve.alias.canvas = false;
    return config;
  },
};

module.exports = nextConfig;