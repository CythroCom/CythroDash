import bundleAnalyzer from '@next/bundle-analyzer'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Performance optimizations
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-progress', '@radix-ui/react-slot'],
  },
  // Enable compression
  compress: true,
  // Webpack optimizations
  webpack: (config, { dev, isServer }) => {
    // Optimize bundle splitting
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          // Vendor chunk for React and core libraries
          vendor: {
            name: 'vendor',
            chunks: 'all',
            test: /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
            priority: 20,
          },
          // UI components chunk
          ui: {
            name: 'ui',
            chunks: 'all',
            test: /[\\/]node_modules[\\/](@radix-ui|class-variance-authority|clsx|tailwind-merge)[\\/]/,
            priority: 15,
          },
          // Icons chunk
          icons: {
            name: 'icons',
            chunks: 'all',
            test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
            priority: 10,
          },
          // Common chunk for shared code
          common: {
            name: 'common',
            chunks: 'all',
            minChunks: 2,
            priority: 5,
            reuseExistingChunk: true,
          },
        },
      }
    }

    // Optimize module resolution
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname),
    }

    return config
  },
}

export default withBundleAnalyzer(nextConfig)
