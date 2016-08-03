import extensionsToRegex from 'ext-to-regex';
import CaseSensitivePathsPlugin from 'case-sensitive-paths-webpack-plugin';

export default function createCommonBundleConfig(options) {
  const {
    optimize,
    src,
    tmp,
    script: {extensions: scriptExtensions},
    babel
  } = options;

  const loaders = []

    //transpile project scripts with the babel loader
    .concat(
      {
        test: extensionsToRegex(scriptExtensions),
        //TODO: pass babel config
        include: src,
        loader: 'babel-loader',
        query: {
          ...babel,
          babelrc: false,
          cacheDirectory: tmp
        }
      }
    )

    //node and browserify loads JSON files like NodeJS does... emulate that for compatibility
    .concat({
      test: /\.json$/,
      loader: 'json-loader'
    })

  ;

  const plugins = [];

  //enforce case sensitive paths to avoid issues between file systems
  if (optimize) {
    plugins.push(new CaseSensitivePathsPlugin());
  }

  //TODO: look for loaders in tradie's and user's node_modules
  //config.resolveLoader = {root: [
  // path.join(__dirname, "node_modules")
  //]});

  //TODO: in v2, enable/disable optimize/minimize
  // new webpack.LoaderOptionsPlugin({
  //  minimize: true,
  //  debug: false
  // });

  return {

    entry: {},

    resolve: {
      extensions: [''].concat(scriptExtensions, '.json')
    },

    module: {

      preLoaders: [],
      loaders: loaders,
      postLoaders: []

    },

    plugins: plugins

  };
}
