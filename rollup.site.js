import json from 'rollup-plugin-json';
import babel from 'rollup-plugin-babel';

export default {
    entry: 'site/index.js',
    format: 'umd',
    moduleName: 'giottojs',
    plugins: [
        json(),
        babel({
            babelrc: false,
            presets: ['es2015-rollup']
        })
    ],
    dest: '../giottojs.org/giottojs.js',
    globals: {
        "d3-view": "giotto",
        "d3-let": "giotto",
        "d3-transition": "giotto"
    }
};