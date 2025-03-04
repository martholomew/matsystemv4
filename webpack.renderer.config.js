const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')

module.exports = {
  devtool: false,
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'renderer'),
          to: path.resolve(__dirname, '.webpack/renderer'),
        },
      ],
    }),
  ],
}
