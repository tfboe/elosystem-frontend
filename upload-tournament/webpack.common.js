const path = require('path');
var webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './src/ts/index.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader'
        ]
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'Upload Tournament',
      template: 'src/html/index.html'
    }),
    new webpack.EnvironmentPlugin({
      'SERVER': 'http://localhost:8000'
    })
  ],
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.json', '.css']
  },
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist')
  },
  node: {
    fs: 'empty',
    net: 'empty'
  },
  externals: {
    jquery: 'jQuery'
  },
};