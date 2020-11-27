const dev = process.env.NODE_ENV !== "production";
if (dev) require("dotenv").config();

module.exports = {
  images: {
    domains: ['arxivisor.s3.eu-central-1.amazonaws.com'],
  },
}