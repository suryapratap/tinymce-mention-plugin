import { build } from "esbuild";
import pkgs from './package.json' with {type: 'json'};
import dts from 'npm-dts';
const { dependencies } = pkgs;
const { Generator } = dts;
new Generator({
    entry: 'src/index.ts',
    output: 'dist/index.d.ts',
}).generate();

const sharedConfig = {
    entryPoints: ["src/index.ts", 'src/plugin.ts'],
    platform: 'browser',
    outdir: "dist",
    bundle: false,
    minify: false,
    sourcemap: true,
    target: ['ES6', 'chrome130', 'firefox130', 'safari20', 'edge130'],
    // external: Object.keys(dependencies),

};

build({
    ...sharedConfig,
    outExtension: { ".js": ".min.js" }
});

build({
    ...sharedConfig,
});
