import path from 'path';
import fileName from 'file-name';
import webpack from 'webpack';
import getClientBundles from '../util/getClientBundles';
import createAppConfig from './util/createAppConfig';
import configureStyleLoader from './util/configureStyles';
import configureAssets from './util/configureAssets';
import deepMerge from '../util/deepMerge';

export default function createClientConfig(options) {
  const {
    optimize,
    src, dest, tmp,
    script: {
      bundles: scriptBundles,
      vendors
    },
    style: {
      bundles: styleBundles,
      extensions: styleExtensions
    },
    webpack: extraWebpackConfig
  } = options;

  let config = createAppConfig(options);

  //configure the client bundles
  const clientBundles = getClientBundles(scriptBundles);
  config.entry = clientBundles.reduce((accum, bundle) => {
    const key = path.join(path.dirname(bundle), fileName(bundle));
    return {
      ...accum,
      [key]: bundle
    };
  }, {});

  //create a common.js bundle for modules that are shared across multiple bundles
  if (clientBundles.length > 1) {
    config.plugins = config.plugins.concat([
      new webpack.optimize.CommonsChunkPlugin({
        name: 'common',
        filename: optimize ? '[name].[chunkhash].js' : '[name].js',
        chunks: clientBundles, //exclude modules from the vendor chunk
        minChunks: clientBundles.length //modules must be used across all the chunks to be included
      })
    ]);
  }//TODO: what about for a single page app where require.ensure is used - I want a common stuff for all chunks in the main entry point

  //use vendor modules from the vendor bundle
  if (vendors.length > 0) {
    //chose DLLPlugin for long-term-caching based on https://github.com/webpack/webpack/issues/1315
    config.plugins = config.plugins.concat([
      new webpack.DllReferencePlugin({
        context: dest,
        manifest: require(path.join(tmp, 'vendor-manifest.json'))
      })
    ]);
  }

  //stylesheets
  configureStyleLoader({
    optimize, src, extensions: styleExtensions
  }, config);

  //assets
  configureAssets({optimize}, config);

  //merge common and client config
  config = {
    ...config,

    target: 'web',
    devtool: optimize ? 'hidden-source-map' : 'cheap-module-eval-source-map',

    context: src,

    output: {
      path: dest,
      filename: optimize ? '[name].[chunkhash].js' : '[name].js'
    }

  };

  //merge extra webpack config
  config = deepMerge(config, extraWebpackConfig);

  return config;
}