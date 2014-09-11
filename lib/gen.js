var fs = require('fs-extra'),
    path = require('path'),
    du = require('du'),
    eachAsync = require('each-async'),
    globby = require('globby'),
    targets = require('./targets'),
    cli = require('./cli');


//Utils
function exit() {
    setTimeout(process.exit);
}

function parseNpmIgnore(content) {
    return content
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map(function (str) {
            return str.trim();
        })
        .filter(function (str) {
            //NOTE: remove empty strings and comments
            return str && str.indexOf('#') !== 0;
        });
}


//Api
module.exports = function (projectDir, options, callback) {
    var ignoreFile = path.join(projectDir, './.npmignore');

    callback = callback || exit;

    cli.info('Reading .npmignore file...').spin();

    fs.ensureFile(ignoreFile, function () {
        fs.readFile(ignoreFile, function (err, content) {
            content = content.toString();

            //NOTE: yep, so selfish...
            content = content || '# Generated by dmn (https://github.com/inikulin/dmn)';

            var alreadyIgnored = parseNpmIgnore(content);

            cli.info('Searching for items to ignore...').spin();

            var ignores = [];

            eachAsync(targets, function (pattern, i, next) {
                globby(pattern, {cwd: projectDir}, function (err, files) {
                    if (files.length)
                        ignores.push(pattern);

                    next();
                });

            }, function () {
                //NOTE: skip already ignored patterns
                ignores = ignores.filter(function (pattern) {
                    return alreadyIgnored.indexOf(pattern) === -1;
                });

                if (!ignores.length) {
                    cli.ok('Unignored patterns was not found. Your .npmignore file is already perfect.');
                    callback();

                    return;
                }

                cli.info('Following patterns will be added to .npmignore file:');
                cli.list(ignores);

                var savePatterns = function () {
                    content += '\r\n\r\n' + ignores.join('\r\n');

                    fs.writeFile(ignoreFile, content, function () {
                        cli.ok('.npmignore file was updated.');
                        callback();
                    });
                };

                if (options.force)
                    savePatterns();
                else {
                    cli.confirm('Save?', function (yes) {
                        if (yes)
                            savePatterns();
                        else {
                            cli.ok('.npmignore file update was canceled.');
                            callback();
                        }
                    });
                }
            });
        });
    });
};
