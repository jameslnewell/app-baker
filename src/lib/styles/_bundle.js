import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';
import pipe from 'promisepipe';
import composer from 'sass-composer';
import watcher from 'sass-composer/lib/watcher';
import autoprefixer from '../autoprefixer-stream';
import minify from '../minify-stream';
import size from '../size-stream';

/**
 * Create a style bundle
 * @param {object}        [options]
 * @param {string}        [options.debug]
 * @param {string}        [options.src]       The source file
 * @param {string}        [options.dest]      The destination file
 * @param {EventEmitter}  [options.emitter]
 * @param {object}        [options.bundler]
 * @returns {object}      [bundle]
 */
function createBundle(options) {

  const debug = options.debug;
  const src = options.src;
  const dest = options.dest;
  const bundler = options.bundler;
  const emitter = options.emitter;

  const args = {src, dest};
  const startTime = Date.now();
  emitter.emit('styles.bundle.started', args);

  const streams = [

    //bundle the styles
    bundler.compose(),

    //autoprefix for older browsers
    autoprefixer({browsers: 'last 2 versions'})

  ];

  //minify if we're not debugging
  if (!debug) {
    streams.push(minify());
  }

  streams.push(size(s => args.size = s));

  return new Promise((resolve, reject) => {
    mkdirp(path.dirname(dest), err => {
      if (err) return reject(err);

      streams.push(fs.createWriteStream(dest));

      //write to a file
      pipe(...streams)
        .then(
          () => {
            args.time = Date.now() - startTime;
            emitter.emit('styles.bundle.finished', args);
            return {error: null};
          },
          error => {
            args.time = Date.now() - startTime;
            args.error = error;
            emitter.emit('styles.bundle.finished', args);
            return {error};
          }
        )
        .then(resolve, reject)
      ;

    });
  });

}
/**
 * Create a style bundler
 * @param {object}        [options]
 * @param {string}        [options.debug]
 * @param {string}        [options.watch]
 * @param {string}        [options.src]       The source file
 * @param {string}        [options.dest]      The destination file
 * @param {EventEmitter}  [options.emitter]
 * @returns {object}      [bundle]
 */
function createBundler(options) {

  const debug = options.debug;
  const watch = options.watch;
  const src = options.src;
  const dest = options.dest;
  const emitter = options.emitter;

  //configure the bundler
  let bundler = composer()
    .entry(src)
    .use(composer.plugins.url({
      transforms: [
        composer.plugins.url.transforms.hashed({
          dir: path.dirname(dest)
        })
      ]
    }))
  ;

  if (watch) {

    bundler = watcher(bundler);
    bundler.on('change', () => createBundle({
      debug,
      src,
      dest,
      bundler,
      emitter
    }));

  }

  return bundler;
}

/**
 * Create an app script bundle
 * @param {object}        [options]
 * @param {string}        [options.debug]
 * @param {string}        [options.watch]
 * @param {string}        [options.dest]      The source file
 * @param {string}        [options.dest]      The destination file
 * @param {array}         [options.vendor]
 * @param {EventEmitter}  [options.emitter]
 * @returns {composer}
 */
function createAppBundle(options) {

  const debug = options.debug;
  const watch = options.watch;
  const src = options.src;
  const dest = options.dest;
  const emitter = options.emitter;

  const bundler = createBundler({
    debug,
    watch,
    src,
    dest,
    emitter
  });

  return createBundle({
    debug,
    src,
    dest,
    emitter,
    bundler
  })
    .then(result => ({...result, bundler}));
}

/**
 * Create style bundles
 * @param {object}        [config]
 * @param {string}        [config.src]       The source directory
 * @param {string}        [config.dest]      The destination directory
 * @param {array}         [config.bundle]
 * @param {array}         [config.vendor]
 * @param {object}        [args]
 * @param {string}        [args.env]
 * @param {string}        [args.watch]
 * @returns {Promise}
 */
export default function(tradie) {

  const {env, root, args: {watch}, config: {src, dest, styles: {bundles}}} = tradie;

  const debug = env !== 'production';

  let streams = [];

  let totalTime = 0;
  let totalSize = 0;

  tradie.emit('styles.bundling.started');
  tradie.on('styles.bundle.finished', result => {

    if (result.time > totalTime) {
      totalTime = result.time;
    }

    totalSize += result.size || 0;
  });

  return new Promise((resolve, reject) => {

    mkdirp(path.resolve(root, dest), err => {
      if (err) return reject(err);

      //TODO: vendors

      //create bundle streams
      streams = streams.concat(bundles.map(
        file => createAppBundle({
          debug,
          watch,
          src: path.join(src, file),
          dest: path.join(dest, path.dirname(file), path.basename(file, path.extname(file)) + '.css'),
          emitter: tradie
        })
      ));

      //wait for all the streams to complete
      Promise.all(streams)
        .then(
          results => {

            const hasErrors = results.reduce(
              (accum, next) => accum || Boolean(next.error), false
            );

            tradie.emit('styles.bundling.finished', {
              src,
              dest,
              count: streams.length,
              time: totalTime,
              size: totalSize,
              error: hasErrors
            });

            if (watch) {

              //stop watching and exit on CTL-C
              process.on('SIGINT', () => {
                results.forEach(({bundler}) => bundler.close());
                resolve(0);
              });

            } else {
              resolve(hasErrors ? -1 : 0);
            }

          }
        )
        .catch(reject)
      ;

    });
  });

}

//TODO: check bundle names - vendor.js and common.js are special and not allowed
