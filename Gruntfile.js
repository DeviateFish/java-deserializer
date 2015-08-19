'use strict';
var LIVERELOAD_PORT = 35729;
var lrSnippet = require('connect-livereload')({port: LIVERELOAD_PORT});
var mountFolder = function (connect, dir) {
  return connect.static(require('path').resolve(dir));
};

module.exports = function(grunt) {
  require('time-grunt')(grunt);
  require('load-grunt-tasks')(grunt);

  grunt.initConfig({

    pkg: grunt.file.readJSON('package.json'),

    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("dd-mm-yyyy") %> */\n',
        sourceMap: true
      },
      dist: {
        files: {
          'dist/<%= pkg.name %>.min.js': ['dist/<%= pkg.name %>.js']
        }
      }
    },

    jshint: {
      files: ['src/**/*.js'],
      options: {
        globals: {
          console: true
        },
        jshintrc: '.jshintrc'
      }
    },

    browserify: {
      dist: {
        options: {
          transform: [
            ["babelify", {
              sourceMaps: true
            }]
          ],
          browserifyOptions: {
            standalone: 'JavaDeserializer',
            debug: true
          }
        },
        files: {
          // if the source file has an extension of es6 then
          // we change the name of the source file accordingly.
          // The result file's extension is always .js
          "./dist/<%= pkg.name %>.js": ["./src/<%= pkg.name %>.js"]
        }
      }
    },

    watch: {
      options: {
        nospawn: true,
        livereload: { liveCSS: false }
      },
      livereload: {
        options: {
          livereload: true
        },
        files: [
          './demo/**/*',
          './dist/<%= pkg.name %>.js'
        ]
      },
      js: {
        files: ['./src/**/*.js'],
        tasks: ['build']
      }
    },
    connect: {
      options: {
        port: 9005,
        // change this to '0.0.0.0' to access the server from outside
        hostname: '0.0.0.0'
      },
      livereload: {
        options: {
          middleware: function (connect) {
            return [
              lrSnippet,
              mountFolder(connect, './'),
            ];
          }
        }
      }
    }

  });

  grunt.registerTask('serve', function (target) {
    grunt.task.run([
      'connect:livereload',
      'watch'
    ]);
  });

  grunt.registerTask('build', [
    'jshint',
    'browserify',
    'uglify'
  ]);

  grunt.registerTask('default', [
    'build',
    'serve'
  ]);
};
