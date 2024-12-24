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
    bundle: false,
    minify: false,
    // external: Object.keys(dependencies),

};

build({
    ...sharedConfig,
    platform: 'browser',
    outdir: "dist",
    outExtension: { ".js": ".min.js" }
});

build({
    ...sharedConfig,
    minify: false,
    platform: 'browser',
    outdir: "dist",
});
