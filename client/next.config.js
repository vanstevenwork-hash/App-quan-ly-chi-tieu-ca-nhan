const withPWA = require('@ducanh2912/next-pwa').default({
    dest: 'public',
    // No service worker in dev — keeps HMR/dev-server behaviour untouched.
    // The SW + precache are generated only on `next build` (production).
    disable: process.env.NODE_ENV === 'development',
    register: true,
    reloadOnOnline: true,
    cacheOnFrontEndNav: true,
    workboxOptions: {
        disableDevLogs: true,
    },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false,
    eslint: {
        // ESLint errors won't fail the build (we fix them in dev)
        ignoreDuringBuilds: true,
    },
    typescript: {
        // Type errors won't fail the build (we fix them in dev)
        ignoreBuildErrors: true,
    },
    images: {
        // Fixed-domain bank/e-wallet logo CDNs, so these can use next/image
        remotePatterns: [
            { protocol: 'https', hostname: 'cdn.vietqr.io' },
            { protocol: 'https', hostname: 'api.vietqr.io' },
            { protocol: 'https', hostname: 'vietqr.net' },
            { protocol: 'https', hostname: 'cdn.haitrieu.com' },
        ],
    },
    experimental: {
        // Rewrite barrel imports (e.g. `import { AreaChart } from 'recharts'`)
        // to direct paths so only the used chart pieces get bundled per route.
        optimizePackageImports: ['recharts'],
    },
    // HTTP caching for immutable public assets only. `/_next/static` and
    // `/_next/image` are already sent immutable by Next; these cover the raw
    // files under /public (icons, illustrations) so a CDN/browser can hold them
    // for a year. HTML/pages are intentionally left alone — they're auth-gated
    // and must stay fresh. manifest gets a short TTL so PWA updates propagate.
    async headers() {
        const YEAR = 'public, max-age=31536000, immutable';
        return [
            { source: '/images/:path*', headers: [{ key: 'Cache-Control', value: YEAR }] },
            { source: '/icon-:size.png', headers: [{ key: 'Cache-Control', value: YEAR }] },
            { source: '/favicon.ico', headers: [{ key: 'Cache-Control', value: YEAR }] },
            { source: '/manifest.json', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }] },
        ];
    },
};

module.exports = withPWA(nextConfig);
