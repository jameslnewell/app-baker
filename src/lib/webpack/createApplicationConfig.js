import getObjectValues from 'object-values';
import webpack from 'webpack';
import BundleUpdatePlugin from 'webpack-bundle-update-hook-plugin';
import createCommonConfig from './createCommonConfig';

class BundleUpdatedPlugin {

  constructor(callback) {
    this.callback = callback;
  }

  apply(compiler) {
    compiler.plugin('bundle-update', (newModules, changedModules, removedModules) => {
      this.callback(getObjectValues(newModules), getObjectValues(changedModules), getObjectValues(removedModules));
    });
  }

}

export default function createApplicationConfig(options) {
  const {env, args: {watch}, onChange} = options;

  const config = createCommonConfig(options);

  //plugins
  if (env === 'production') {

    config.plugins = config.plugins.concat([

      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(env)
      }),

      new webpack.optimize.OccurenceOrderPlugin(),
      new webpack.optimize.DedupePlugin(),
      new webpack.optimize.UglifyJsPlugin({
        output: {comments: false},
        compress: {warnings: false}
      })

      //TODO: plugin to create rev-manifest.json to map hashed files to their original names => webpack-manifest-plugin? manifest-revision-webpack-plugin?

    ]);

  }

  //emit bundle update events
  if (watch) {
    config.plugins = config.plugins.concat([
      new BundleUpdatePlugin(),
      new BundleUpdatedPlugin(onChange)
    ]);
  }

  return config;
}