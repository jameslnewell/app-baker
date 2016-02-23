
import getArgs from '../lib/getArguments';
import getConfig from '../lib/getConfig';
import logger from '../lib/logger';
import scripts from '../lib/scripts';
import styles from '../lib/styles';

export const name = 'build';
export const desc = 'Lint and bundle script and style files';

/**
 * Build the script and style files
 * @param {object} context
 */
export default function(context) {

  program
    .description('Clean bundled scripts and styles')
    .option('--production', 'optimise script and style bundles for a production environment')
    .option('-w, --watch', 're-build script and styles bundles when they change')
    .option('-v, --verbose', 'verbosely list script and style bundles')
    .parse(process.argv)
  ;

  const args = getArgs(program);
  const config = getConfig(args);
  const buildLogger = logger(args);
  const scriptBuilder = scripts(config.scripts, args);
  const styleBuilder = styles(config.styles, args);

  scriptBuilder
    .on('error', error => {
      buildLogger.error(error);
      process.exit(-1);
    })
    .on('lint:finish', result => {
      if (result.errors !== 0) {
        process.exit(-1);
      }
    })
    .lint()
    .then(
      () => {

        let scriptResult = null;
        let styleResult = null;

        Promise.all([
            scriptBuilder
              .on(
                'bundle:finish',
                result => buildLogger.scriptBundleFinished(result)
              )
              .on(
                'bundles:finish',
                result => scriptResult = result
              )
              .bundle(),
            styleBuilder
              .on(
                'bundle:finish',
                result => buildLogger.styleBundleFinished(result)
              )
              .on(
                'bundles:finish',
                result => styleResult = result
              )
              .bundle()
          ])
          .then(
            result => {
              buildLogger.scriptBundlesFinished(scriptResult);
              buildLogger.styleBundlesFinished(styleResult);
              if (scriptResult.error || styleResult.error) {
                process.exit(-1);
              }
            },
            error => {
              buildLogger.error(error);
              process.exit(-1);
            }
          )
        ;

      },
      () => {
        log.error(' => lint errors found');
        process.exit(-1);
      }
    )
  ;


}
