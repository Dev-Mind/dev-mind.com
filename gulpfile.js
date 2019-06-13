'use strict';

const gulp = require('gulp');
const del = require('del');
const path = require('path');
const imagemin = require('gulp-imagemin');
const imageminJpegtran = require('imagemin-jpegtran');
const workboxBuild = require('workbox-build');
const devMindGulpBuilder = require('devmind-website');
const website = new devMindGulpBuilder.DevMindGulpBuilder();
const fs = require('fs');

const $ = require('gulp-load-plugins')();

// Service worker version is read in a file
const FILE_VERSION = './version';
const serviceWorkerVersion = require(FILE_VERSION).swVersion;

const HTMLMIN_OPTIONS = {
  removeComments: true,
  collapseWhitespace: true,
  collapseBooleanAttributes: true,
  removeAttributeQuotes: true,
  removeRedundantAttributes: true,
  removeEmptyAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  removeOptionalTags: true,
  minifyCSS: true,
  minifyJS: true,
  jsmin: true
};

const HANDLEBARS_PARTIALS = [
  {key: '_html_header', path: 'src/templates/_html_header.handlebars'},
  {key: '_page_header', path: 'src/templates/_page_header.handlebars'},
  {key: '_page_footer', path: 'src/templates/_page_footer.handlebars'},
  {key: '_html_footer', path: 'src/templates/_html_footer.handlebars'}
];

const CACHE_BUSTING_EXTENSIONS = ['.js', '.css', '.html', '.xml'];

let modeDev = false;

gulp.task('styles', (cb) => {
  gulp.src(['src/sass/devmind.scss', 'src/sass/main.scss', 'src/sass/bloglist.scss', 'src/sass/blog/blog.scss'])
      .pipe($.newer('build/.tmp/css'))
      .pipe($.sourcemaps.init())
      .pipe($.sass({
                     precision: 10
                   }).on('error', $.sass.logError))
      .pipe($.autoprefixer())
      .pipe(gulp.dest('build/.tmp/css'))
      // Concatenate and minify styles
      .pipe($.if('*.css', $.cssnano()))
      .pipe($.size({title: 'styles'}))
      .pipe($.rev())
      .pipe($.sourcemaps.write('./'))
      .pipe(gulp.dest('build/dist/css'))
      .pipe($.rev.manifest())
      .pipe(gulp.dest('build/dist/css'))
      .on('end', () => cb())
});

gulp.task('blog-indexing', () =>
  gulp.src('src/blog/**/*.adoc')
      .pipe(website.readAsciidoc())
      .pipe(website.convertToHtml())
      .pipe(website.convertToJson('blogindex.json'))
      .pipe(gulp.dest('build/.tmp'))
);

gulp.task('blog-rss', () =>
  gulp.src('build/.tmp/blogindex.json')
      .pipe($.wait2(() => website.fileExist('build/.tmp/blogindex.json')))
      .pipe(website.readIndex())
      .pipe(website.convertToRss('blog.xml'))
      .pipe(gulp.dest('build/dist/rss'))
);

gulp.task('blog-index', () =>
  gulp.src('build/.tmp/blogindex.json')
      .pipe($.wait2(() => website.fileExist('build/.tmp/blogindex.json')))
      .pipe(website.readIndex())
      .pipe(website.convertToBlogList('src/templates/index.handlebars', HANDLEBARS_PARTIALS, 'index.html', 1))
      .pipe(gulp.dest('build/.tmp'))
      .pipe($.htmlmin(HTMLMIN_OPTIONS))
      .pipe(gulp.dest('build/dist'))
);

gulp.task('blog-list', () =>
  gulp.src('build/.tmp/blogindex.json')
      .pipe($.wait2(() => website.fileExist('build/.tmp/blogindex.json')))
      .pipe(website.readIndex())
      .pipe(website.convertToBlogList('src/templates/blog_list.handlebars', HANDLEBARS_PARTIALS, 'blog.html', 4))
      .pipe(gulp.dest('build/.tmp'))
      .pipe($.htmlmin(HTMLMIN_OPTIONS))
      .pipe(gulp.dest('build/dist'))
);

gulp.task('blog-archive', () =>
  gulp.src('build/.tmp/blogindex.json')
      .pipe($.wait2(() => website.fileExist('build/.tmp/blogindex.json')))
      .pipe(website.readIndex())
      .pipe(website.convertToBlogList('src/templates/blog_archive.handlebars', HANDLEBARS_PARTIALS, 'blog_archive.html'))
      .pipe(gulp.dest('build/.tmp'))
      .pipe($.htmlmin(HTMLMIN_OPTIONS))
      .pipe(gulp.dest('build/dist'))
);

gulp.task('blog-page', (cb) => {
  gulp.src('src/blog/**/*.adoc')
      .pipe(website.readAsciidoc())
      .pipe(website.convertToHtml())
      .pipe(website.highlightCode({selector: 'pre.highlight code'}))
      .pipe(website.convertToBlogPage('src/templates/blog.handlebars', HANDLEBARS_PARTIALS, 'build/.tmp/blogindex.json'))
      .pipe(gulp.dest('build/.tmp/blog'))
      .pipe($.htmlmin(HTMLMIN_OPTIONS))
      .pipe(gulp.dest('build/dist/blog'))
      .on('end', () => cb())
});

gulp.task('blog', gulp.series('blog-indexing',
                              'blog-page',
                              'blog-list',
                              'blog-rss',
                              'blog-archive',
                              'blog-index'));

gulp.task('lint', () =>
  gulp.src('src/js/**/*.js')
      .pipe($.eslint())
      .pipe($.eslint.format())
      .pipe($.if(modeDev, $.eslint.failOnError()))
);

gulp.task('html-indexing', () =>
  gulp.src(`src/html/**/*.html`)
      .pipe(website.readHtml())
      .pipe(website.convertToJson('pageindex.json'))
      .pipe(gulp.dest('build/.tmp')));

gulp.task('html-template', () =>
  gulp.src(`src/html/**/*.html`)
      .pipe(website.readHtml())
      .pipe(website.applyTemplate(`src/templates/site.handlebars`, HANDLEBARS_PARTIALS))
      .pipe($.size({title: 'html', showFiles: true}))
      .pipe(gulp.dest('build/.tmp'))
      .pipe($.htmlmin(HTMLMIN_OPTIONS))
      .pipe(gulp.dest('build/dist')));

gulp.task('html', gulp.parallel('html-indexing', 'html-template'));

gulp.task('training-indexing', () =>
  gulp.src(`src/training/**/*.adoc`)
      .pipe(website.readAsciidoc())
      .pipe(website.convertToHtml())
      .pipe(website.convertToJson('trainingindex.json'))
      .pipe(gulp.dest('build/.tmp'))
);

gulp.task('training-list', (cb) =>
  gulp.src('build/.tmp/trainingindex.json')
      .pipe(website.readIndex())
      .pipe(website.convertToBlogList('src/templates/trainings.handlebars', HANDLEBARS_PARTIALS, 'trainings.html', 100))
      .pipe(gulp.dest('build/.tmp/training'))
);

gulp.task('training-page', (cb) => {
  gulp.src('src/training/**/*.adoc')
      .pipe($.wait2(() => website.fileExist('build/.tmp/trainingindex.json')))
      .pipe(website.readAsciidoc())
      .pipe(website.convertToHtml())
      .pipe(website.highlightCode({selector: 'pre.highlight code'}))
      .pipe(
        website.convertToBlogPage('src/templates/training.handlebars', HANDLEBARS_PARTIALS, 'build/.tmp/trainingindex.json'))
      .pipe($.size({title: 'html', showFiles: true}))
      .pipe(gulp.dest('build/.tmp/training'))
      .on('end', () => cb())
});

gulp.task('training-copy', (cb) => {
  gulp.src('build/.tmp/training/**/*.html')
      .pipe($.htmlmin(HTMLMIN_OPTIONS))
      .pipe(gulp.dest('build/dist/training'))
      .on('end', () => cb())
});

gulp.task('training', gulp.series('training-indexing', 'training-list', 'training-page', 'training-copy'));

gulp.task('local-js', () =>
  gulp.src(['src/js/*.js'])
      .pipe($.sourcemaps.init())
      .pipe($.babel({
                      presets: ['@babel/env']
                    }))
      .pipe($.rev())
      .pipe($.sourcemaps.write())
      .pipe($.uglify())
      .pipe($.size({title: 'scripts'}))
      .pipe($.replace('$serviceWorkerVersion', serviceWorkerVersion))
      .pipe(gulp.dest('build/dist/js'))
      .pipe($.rev.manifest())
      .pipe(gulp.dest('build/dist/js'))
);

gulp.task('vendor-js', () =>
  gulp.src(['node_modules/fg-loadcss/src/*.js'])
      .pipe($.uglify())
      .pipe(gulp.dest('build/dist/js'))
);

/**
 * Image pre processing is used to minify these assets
 */
gulp.task('images-pre', () =>
  modeDev ?
    gulp.src('src/images/**/*.{svg,png,jpg}').pipe(gulp.dest('build/.tmp/img')) :
    gulp.src('src/images/**/*.{svg,png,jpg}')
      .pipe(imagemin([imagemin.gifsicle({interlaced: true}), imagemin.jpegtran({progressive: true}), imagemin.optipng(), imagemin.svgo()]))
      .pipe(gulp.dest('build/.tmp/img'))
      .pipe($.if('**/*.{jpg,png}', $.webp()))
      .pipe($.size({title: 'images', showFiles: false}))
      .pipe(gulp.dest('build/.tmp/img'))
);

/**
 * Images generated in image pre processing are renamed with a MD5 (cache busting) and copied
 * in the dist directory
 */
gulp.task('images', () =>
  gulp.src('build/.tmp/img/**/*.{svg,png,jpg,webp}')
      //.pipe(gulp.dest('build/dist/img'))
      .pipe($.rev())
      .pipe(gulp.dest('build/dist/img'))
      .pipe($.rev.manifest())
      .pipe(gulp.dest('build/dist/img'))
);

/**
 * Image post processing is used to copy in dist directory images used without cache busting id
 */
gulp.task('images-post', () =>
  gulp.src('src/images/**/logo*.*')
      .pipe(gulp.dest('build/dist/img'))
);

gulp.task('copy', (cb) => {
  gulp.src([
             'src/*.{ico,html,txt,json,webapp,xml}',
             'src/**/*.htaccess',
             'node_modules/workbox-sw/build/*-sw.js'
           ], {
             dot: true
           })
      .pipe($.size({title: 'copy', showFiles: true}))
      .pipe(gulp.dest('build/dist'))
      .on('end', () => cb())
});

gulp.task('sitemap', () =>
  gulp.src(['build/.tmp/blogindex.json', 'build/.tmp/pageindex.json'])
      .pipe(website.readIndex())
      .pipe(website.convertToSitemap())
      .pipe(gulp.dest('build/dist'))
);

gulp.task('service-worker-bundle', () => {
  return workboxBuild.injectManifest({
                                  swSrc: 'src/sw.js',
                                  swDest: 'build/.tmp/sw.js',
                                  globDirectory: './build/dist',
                                  globIgnores: ['training/**/*.*', '**/sw*.js', '**/workbox*.js'],
                                  globPatterns: ['**/*.{js,svg}']
                                  // we don't load image files on SW precaching step
                                })
                .catch((err) => {
                  console.log('[ERROR] This happened: ' + err);
                });
});

gulp.task('service-worker-optim', () =>
  gulp.src(`build/.tmp/*.js`)
      .pipe($.rev())
      .pipe($.replace('$serviceWorkerVersion', serviceWorkerVersion))
      .pipe($.sourcemaps.init())
      .pipe($.sourcemaps.write())
      .pipe($.uglify())
      .pipe($.size({title: 'scripts'}))
      .pipe($.sourcemaps.write('.'))
      .pipe(gulp.dest(`build/dist`))
      .pipe($.rev.manifest())
      .pipe(gulp.dest(`build/dist`))
);

gulp.task('service-worker-updgrade', (fg) => {
  // We have to save the new service worker version for next build
  fs.writeFile(FILE_VERSION + '.json', '{ "swVersion" : ' + (serviceWorkerVersion + 1) +'}', function (err, file) {
    if (err) throw err;
    console.log('File with version saved!');
  });
  fg();
});

gulp.task('service-worker', gulp.series('service-worker-bundle', 'service-worker-optim', 'service-worker-updgrade'));



const cacheBusting = (path) =>
  gulp.src(path)
      .pipe($.revReplace(
        {manifest: gulp.src('build/dist/img/rev-manifest.json'), replaceInExtensions: CACHE_BUSTING_EXTENSIONS}))
      .pipe($.revReplace({manifest: gulp.src('build/dist/css/rev-manifest.json')}))
      .pipe($.revReplace({manifest: gulp.src('build/dist/js/rev-manifest.json')}))
      .pipe(gulp.dest('build/dist'))

gulp.task('cache-busting-dev', () => cacheBusting('build/dist/**/*.{html,js,css}'));
gulp.task('cache-busting', () => cacheBusting('build/dist/**/*.{html,js,css,xml,json,webapp}'));
gulp.task('cache-busting-sw', () =>  gulp.src('build/dist/**/main*.js')
                                         .pipe($.revReplace({manifest: gulp.src('build/dist/rev-manifest.json'), replaceInExtensions: ['.js']}))
                                         .pipe(gulp.dest('build/dist')));

gulp.task('compress-svg', (cb) => {
  gulp.src('build/dist/**/*.svg')
      .pipe($.svg2z())
      .pipe(gulp.dest('build/dist'))
      .on('end', () => cb())
});

gulp.task('compress-img', (cb) => {
  gulp.src('build/dist/**/*.{js,css,png,webp,jpg,html}')
      .pipe($.gzip())
      .pipe(gulp.dest('build/dist'))
      .on('end', () => cb())
});

gulp.task('compress', gulp.parallel('compress-svg', 'compress-img'));


gulp.task('watch-html', () =>
  gulp.watch('src/**/*.html', gulp.series('html', 'cache-busting-dev')));
gulp.task('watch-scss', () =>
  gulp.watch('src/**/*.{scss,css}', gulp.series('styles', 'blog', 'training', 'html', 'cache-busting-dev')));
gulp.task('watch-adoc', () =>
  gulp.watch('src/**/*.adoc', gulp.series('blog', 'training', 'cache-busting-dev')));
gulp.task('watch-js', () =>
  gulp.watch('src/**/*.js', gulp.series('lint', 'local-js', 'blog', 'training', 'html', 'cache-busting-dev')));
gulp.task('watch-img', () =>
  gulp.watch('src/images/**/*', gulp.series('images', 'blog', 'training', 'html', 'cache-busting-dev')));
gulp.task('watch-template', () =>
  gulp.watch('src/**/*.handlebars', gulp.series('blog', 'training', 'html', 'cache-busting-dev')));


gulp.task('watch', gulp.parallel('watch-html', 'watch-scss', 'watch-adoc', 'watch-js', 'watch-img', 'watch-template'));

gulp.task('clean', () => del('build', {dot: true}));

gulp.task('initModeDev', (cb) => {
  modeDev = true;
  cb();
});

gulp.task('build', gulp.series('images-pre',
                               'styles',
                               'blog',
                               'images',
                               'images-post',
                               'lint',
                               'html',
                               'local-js',
                               'vendor-js',
                               'copy',
                               'training',
                               'cache-busting',
                               'service-worker',
                               'cache-busting-sw'));

gulp.task('build-dev', gulp.series('clean', 'initModeDev', 'build'));

// Build production files, the default task
// Before a delivery we need to launch blog-firebase to update the pages on database
gulp.task('default', gulp.series('clean', 'build', 'sitemap'));

// Build dev files
gulp.task('serve', gulp.series('initModeDev', 'build', 'watch'));

