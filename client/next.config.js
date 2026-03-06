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
};

module.exports = nextConfig;
