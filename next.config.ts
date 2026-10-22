/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // どんな環境でも強制的に動的サーバーモードでビルドする設定
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
