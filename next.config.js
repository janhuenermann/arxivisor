const dev = process.env.NODE_ENV !== "production";
if (dev) require("dotenv").config();

module.exports = {
    
  images: {
    domains: ['arxivisor.s3.eu-central-1.amazonaws.com'],
  },

  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      issuer: {
        test: /\.(js|ts)x?$/,
      },
      use: ['@svgr/webpack'],
    });

    return config;
  },

}