const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

// Bundle name: the gateway serves it at /res/mapstudio/<name>.js and .css.
// Must match BUNDLE_NAME in common/.../MapStudioModule.java.
const LibName = 'MapStudio';

// Mode comes from the CLI (--mode production|development, see package.json).
// Production is what ships in the .modl: minified, no source maps.
module.exports = (env, argv) => ({
    entry: {
        [LibName]: path.join(__dirname, 'typescript/index.ts')
    },
    output: {
        // webpack writes straight into the Gradle resources dir for this subproject.
        path: path.resolve(__dirname, 'build/generated-resources/mounted'),
        filename: '[name].js',
        library: '[name]',
        libraryTarget: 'umd',
        umdNamedDefine: true,
        clean: true
    },
    devtool: argv.mode === 'development' ? 'source-map' : false,
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.css']
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: { loader: 'ts-loader' },
                exclude: /node_modules/
            },
            {
                test: /\.css$/,
                use: [
                    MiniCssExtractPlugin.loader,
                    { loader: 'css-loader', options: { url: false } }
                ]
            }
        ]
    },
    plugins: [
        new MiniCssExtractPlugin({ filename: '[name].css' }),
        // MapLibre 6 runs its worker from a separate file next to the library.
        // Inside a bundle it cannot find that file by itself, so the worker is
        // copied beside the bundle and the component points MapLibre at it
        // (WORKER_URL in typescript/MapStudio.tsx). Published as .js: the
        // gateway serves .mjs with no content type and nosniff, which the
        // browser refuses to run as a worker.
        new CopyPlugin({
            patterns: [
                { from: path.join(__dirname, 'node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs'), to: 'maplibre-gl-worker.js' }
            ]
        })
    ],
    optimization: {
        // '...' keeps webpack's default JS minimizer; CssMinimizerPlugin covers the
        // extracted stylesheet, which production mode alone leaves as is.
        minimizer: ['...', new CssMinimizerPlugin()]
    },
    performance: {
        // MapLibre is a large library; the size hints would only add noise.
        hints: false
    },
    ignoreWarnings: [
        // MapLibre loads an optional decoder with a dynamic import that webpack
        // cannot resolve statically; the map does not use it.
        { module: /maplibre-gl/, message: /Critical dependency/ }
    ],
    // Provided globally by the Perspective runtime, so never bundled.
    externals: {
        'react': 'React',
        'react-dom': 'ReactDOM',
        'mobx': 'mobx',
        'mobx-react': 'mobxReact',
        '@inductiveautomation/perspective-client': 'PerspectiveClient'
    }
});
