import {terser} from 'rollup-plugin-terser';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import replace from '@rollup/plugin-replace';
import path from 'path';

function build(){
    const name = 'containing-triangle';
    return [
        {
            input: `${name}.ts`,
            output: {
                name,
                format: 'es',
                file: `lib/${name}.mjs`
            },
            external: ['robust-predicates'],
            plugins: [typescript()]
        },
        {
            input: `reroll.mjs`, // typescript & resolve don't play well together
            output: {
                name,
                format: 'commonjs',
                file: `lib/${name}.cjs`,
                exports: 'default'
            },
            plugins: [typescript(), resolve()]
        },
        {
            input: `reroll.mjs`,
            output: {
                name,
                format: 'umd',
                file: `lib/${name}.js`,
                exports: 'default'
            },
            plugins: [resolve()]
        },
        {
            input: `reroll.mjs`,
            output: {
                name,
                format: 'umd',
                file: `lib/${name}.min.js`,
                exports: 'default'
            },
            plugins: [resolve(), terser()]
        }
    ];
}

function test(name){
    return [
        {
            input: `${name}.ts`,
            output: {
                name,
                format: 'es',
                file: `test/${name}.mjs`
            },
            external: ['robust-predicates', 'robust-segment-intersect', 'tape', 'delaunator', 'fs', 'path', '@kninnug/constrainautor'],
            plugins: [replace({
                preventAssignment: true,
                values: {
                    'import.meta.url': function(file){
                        return JSON.stringify('file://' + file.replace(path.sep, '/'));
                    }
                }
            }), typescript()]
        }
    ]
}

export default [
    ...build('containing-triangle'),
    ...test('test')
];
