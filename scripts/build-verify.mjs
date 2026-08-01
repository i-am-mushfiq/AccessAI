/* eslint-disable no-console */
import { spawn } from 'node:child_process';

/**
 * A production build that cannot break a running dev server.
 *
 * `next dev` and `next build` both own `.next`, and their contents are not
 * interchangeable — a production build replaces the dev server's vendor chunks,
 * after which every request fails with `Cannot find module
 * './vendor-chunks/zod.js'` until the directory is deleted. The dev server never
 * recovers on its own, and the error names a file nobody wrote, so it reads as a
 * broken dependency rather than as two processes fighting over one directory.
 *
 * That is not a hypothetical: the README asks for `npm run build` as a
 * verification step, which is exactly the kind of thing you run in a second
 * terminal with the app still up.
 *
 * So this builds into `.next-verify` instead. Use it to check that the build and
 * lint pass; use plain `npm run build` for a real deploy, when nothing else is
 * running.
 *
 * A wrapper script rather than an inline `NEXT_DIST_DIR=… next build`, because
 * npm runs scripts through cmd.exe on Windows, where that prefix syntax is a
 * parse error.
 */
const DIST = '.next-verify';

console.log(`Building into ${DIST}/ so a running dev server is left alone.\n`);

const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, NEXT_DIST_DIR: DIST },
});

child.on('exit', (code) => {
  if (code === 0) {
    console.log(`\nBuild and lint passed. ${DIST}/ is scratch output — safe to delete.`);
  }
  process.exit(code ?? 1);
});
