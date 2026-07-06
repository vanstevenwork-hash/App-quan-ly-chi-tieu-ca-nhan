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
};

module.exports = nextConfig;
