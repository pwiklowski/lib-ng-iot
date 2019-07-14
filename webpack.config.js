const path = require("path");

module.exports = {
  watch: true,
  entry: "./src/index.ts",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"]
  },
  output: {
    filename: "index.js",
    libraryTarget: "umd",
    library: "lib",
    umdNamedDefine: true,
    path: path.resolve(__dirname, "build"),
    globalObject: "this"
  }
};
