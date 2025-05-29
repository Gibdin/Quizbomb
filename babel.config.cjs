module.exports = {
  presets: [["@babel/preset-env", { targets: { node: "current" } }]],
  plugins: [
    "@babel/plugin-syntax-import-meta",
    "@babel/plugin-proposal-optional-chaining",
    "@babel/plugin-proposal-nullish-coalescing-operator",
    "transform-import-meta",
    "@babel/plugin-transform-modules-commonjs",
  ],
};
