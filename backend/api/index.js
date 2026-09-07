// Vercel entrypoint: every request (whatever the path) gets routed here by
// the rewrite in vercel.json, and Express does its own routing internally
// based on the original request path.
module.exports = require("../src/index.js");
