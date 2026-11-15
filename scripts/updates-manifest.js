#!/usr/bin/env node
/**
 * updates-manifest.js — build a multi-platform Tauri updater manifest.
 *
 * The updater manifest is a single `updates.json` served from
 * `releases/latest/download/updates.json`. Every platform that ships an
 * artifact must have an entry under `platforms`, otherwise that platform
 * silently never updates.
 *
 * Because each platform is built on a different machine, this script
 * MERGES: pass `--base` with the manifest that is already published and
 * the other platforms are preserved while local ones are replaced.
 *
 * Usage (macOS, after notarization):
 *   node scripts/updates-manifest.js \
 *     --version 0.2.0 \
 *     --platform darwin-aarch64=src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/Roundtable_0.2.0_aarch64.dmg \
 *     --out releases/v0.2.0/updates.json
 *
 * Usage (Windows, merging with the published manifest):
 *   node scripts/updates-manifest.js --version 0.2.0 \
 *     --base https://github.com/Just-Me-Media/FreeLLMAPI-Roundtable/releases/latest/download/updates.json \
 *     --platform windows-x86_64=src-tauri/target/release/bundle/nsis/Roundtable_0.2.0_x64-setup.exe \
 *     --out updates.json
 *
 * Notes:
 *  - The signature written into the manifest is the contents of the `.sig`
 *    file produced by `cargo tauri signer sign`.
 *  - The signing key MUST match the `plugins.updater.pubkey` baked into the
 *    app, or the app rejects the update. This script checks that and fails.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const DEFAULT_REPO = 'Just-Me-Media/FreeLLMAPI-Roundtable';

// ---------------------------------------------------------------- args ----
function parseArgs(argv) {
  const out = { platform: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const take = () => {
      const v = argv[++i];
      if (v === undefined) die(`missing value for ${a}`);
      return v;
    };
    switch (a) {
      case '--version': out.version = take(); break;
      case '--out': out.out = take(); break;
      case '--base': out.base = take(); break;
      case '--notes': out.notes = take(); break;
      case '--repo': out.repo = take(); break;
      case '--url-prefix': out.urlPrefix = take(); break;
      case '--key': out.key = take(); break;
      case '--password': out.password = take(); break;
      case '--config': out.config = take(); break;
      case '--platform': out.platform.push(take()); break;
      case '--allow-key-mismatch': out.allowKeyMismatch = true; break;
      case '-h': case '--help': out.help = true; break;
      default: die(`unknown argument: ${a}`);
    }
  }
  return out;
}

function die(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

// ------------------------------------------------------------ key utils ---
function decodePubkey(b64) {
  const txt = Buffer.from(b64.trim(), 'base64').toString('utf8');
  const lines = txt.trim().split('\n');
  const body = Buffer.from(lines[1].trim(), 'base64');
  const alg = body.subarray(0, 2);
  const keyIdLE = body.subarray(2, 10);
  const keyIdBE = Buffer.from(keyIdLE).reverse().toString('hex').toUpperCase();
  return { comment: lines[0], alg: alg.toString('hex').toUpperCase(), keyId: keyIdBE };
}

function keyIdFromSignature(sigB64) {
  const txt = Buffer.from(sigB64.trim(), 'base64').toString('utf8');
  const lines = txt.trim().split('\n');
  const blob = Buffer.from(lines[1].trim(), 'base64');
  return Buffer.from(blob.subarray(2, 10)).reverse().toString('hex').toUpperCase();
}

function findSignerKey(args) {
  if (args.key) return args.key;
  if (process.env.TAURI_SIGNING_PRIVATE_KEY_PATH) return process.env.TAURI_SIGNING_PRIVATE_KEY_PATH;
  // CI convention: the key CONTENT lives in TAURI_SIGNING_PRIVATE_KEY.
  if (process.env.TAURI_SIGNING_PRIVATE_KEY) {
    const p = path.join(os.tmpdir(), `roundtable-updater-${process.pid}.key`);
    fs.writeFileSync(p, process.env.TAURI_SIGNING_PRIVATE_KEY, { mode: 0o600 });
    process.on('exit', () => { try { fs.unlinkSync(p); } catch {} });
    return p;
  }
  const local = path.resolve('updater.key');
  if (fs.existsSync(local)) return local;
  die('no signing key found. Pass --key <path> or set TAURI_SIGNING_PRIVATE_KEY_PATH / TAURI_SIGNING_PRIVATE_KEY.');
}

function tauriCli() {
  // Prefer the project-pinned CLI (node_modules) so the signature is produced
  // by the same version that built the app. Invoke its JS entry point through
  // the current node binary: this works identically on Windows and Unix and
  // avoids the `.cmd` shim, which Node refuses to execute without a shell.
  const cliJs = path.join('node_modules', '@tauri-apps', 'cli', 'tauri.js');
  if (fs.existsSync(cliJs)) {
    const cli = { cmd: process.execPath, args: [cliJs] };
    try {
      execFileSync(cli.cmd, [...cli.args, '--version'], { stdio: 'ignore' });
      return cli;
    } catch {}
  }
  for (const [cmd, args] of [['cargo', ['tauri']], ['npx', ['--no-install', 'tauri']]]) {
    try {
      execFileSync(cmd, [...args, '--version'], { stdio: 'ignore', shell: process.platform === 'win32' });
      return { cmd, args };
    } catch {}
  }
  die('tauri CLI not found. Run `npm ci` in the repo root, or install `cargo install tauri-cli`.');
}

function signFile(file, keyPath, password) {
  // `cargo tauri signer sign` writes <file>.sig next to the artifact.
  const cli = tauriCli();
  // The CLI reads TAURI_SIGNING_PRIVATE_KEY itself; passing -f as well is an
  // argument conflict, so strip the content variable from the child env.
  const env = { ...process.env, TAURI_SIGNING_PRIVATE_KEY_PATH: keyPath, TAURI_SIGNING_PRIVATE_KEY_PASSWORD: password || '' };
  delete env.TAURI_SIGNING_PRIVATE_KEY;
  try {
    execFileSync(cli.cmd, [...cli.args, 'signer', 'sign', '-f', keyPath, '-p', password || '', file], {
      stdio: ['ignore', 'ignore', 'pipe'],
      env,
    });
  } catch (e) {
    die(`signing failed for ${file}\n${e.stderr ? e.stderr.toString() : e.message}`);
  }
  const sigPath = `${file}.sig`;
  if (!fs.existsSync(sigPath)) die(`expected signature file not found: ${sigPath}`);
  return fs.readFileSync(sigPath, 'utf8').trim();
}

// -------------------------------------------------------------- manifest --
async function loadBase(spec) {
  if (!spec) return null;
  try {
    if (/^https?:\/\//i.test(spec)) {
      const res = await fetch(spec);
      if (!res.ok) {
        console.warn(`   ⚠️  base manifest fetch returned HTTP ${res.status} — starting fresh`);
        return null;
      }
      return await res.json();
    }
    if (!fs.existsSync(spec)) {
      console.warn(`   ⚠️  base manifest not found at ${spec} — starting fresh`);
      return null;
    }
    return JSON.parse(fs.readFileSync(spec, 'utf8'));
  } catch (e) {
    console.warn(`   ⚠️  could not read base manifest (${e.message}) — starting fresh`);
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^\/\*\*?/, ''));
    return;
  }

  if (!args.version) die('--version is required');
  if (!args.platform.length) die('at least one --platform <target>=<file> is required');

  const repo = args.repo || DEFAULT_REPO;
  const configPath = args.config || path.resolve('src-tauri/tauri.conf.json');
  const keyPath = path.resolve(findSignerKey(args));
  const password = args.password !== undefined ? args.password : (process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD || '');

  // ---- verify the signing key matches the pubkey baked into the app ----
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const pubkeyB64 = cfg?.plugins?.updater?.pubkey;
  if (!pubkeyB64) die(`no plugins.updater.pubkey found in ${configPath}`);
  const trusted = decodePubkey(pubkeyB64);

  console.log(`\n=== Updater manifest ===`);
  console.log(`version      : ${args.version}`);
  console.log(`repo         : ${repo}`);
  console.log(`signing key  : ${keyPath}`);
  console.log(`trusted key  : ${trusted.keyId}  (from ${path.relative(process.cwd(), configPath)})`);

  // ---- sign every artifact ----
  const urlPrefix = args.urlPrefix ||
    `https://github.com/${repo}/releases/download/v${args.version}`;

  const signed = [];
  for (const spec of args.platform) {
    const eq = spec.indexOf('=');
    if (eq === -1) die(`--platform must be <target>=<file>, got: ${spec}`);
    const target = spec.slice(0, eq).trim();
    const file = path.resolve(spec.slice(eq + 1).trim());
    if (!fs.existsSync(file)) die(`artifact not found: ${file}`);

    console.log(`\n   signing ${target}`);
    console.log(`     file: ${file}`);
    const signature = signFile(file, keyPath, password);

    const sigKeyId = keyIdFromSignature(signature);
    const ok = sigKeyId === trusted.keyId;
    console.log(`     sig key id: ${sigKeyId}  ${ok ? '✅ matches' : '❌ MISMATCH'}`);

    if (!ok && !args.allowKeyMismatch) {
      die(
        `signing key does not match the pubkey baked into the app.\n\n` +
        `   app trusts : ${trusted.keyId}\n` +
        `   you signed : ${sigKeyId}\n\n` +
        `   The app would reject this update. Either:\n` +
        `     a) sign with the private key matching ${trusted.keyId}, or\n` +
        `     b) rotate plugins.updater.pubkey in tauri.conf.json (and\n` +
        `        tauri.windows.conf.json) to the key you control.\n\n` +
        `   Pass --allow-key-mismatch to build the manifest anyway (testing only).`
      );
    }

    signed.push({ target, file, signature });
  }

  // ---- merge with base ----
  const base = await loadBase(args.base);
  let inherited = {};
  if (base?.platforms) {
    if (base.version && base.version !== args.version) {
      // Carrying another version's platform entries into this manifest would
      // point users at an artifact that does not contain the advertised
      // version — the updater would "succeed" while installing old code.
      console.warn(`\n   ⚠️  base manifest is v${base.version}, this build is v${args.version}`);
      console.warn(`       ignoring its platforms (publish each version's manifest from scratch)`);
    } else {
      inherited = base.platforms;
      console.log(`\n   base manifest contributed ${Object.keys(inherited).length} platform(s): ${Object.keys(inherited).join(', ')}`);
    }
  }
  const platforms = { ...inherited };
  for (const s of signed) {
    platforms[s.target] = {
      url: `${urlPrefix}/${path.basename(s.file)}`,
      signature: s.signature,
    };
  }

  const manifest = {
    version: args.version,
    notes: args.notes || (Object.keys(inherited).length ? base?.notes : null) || 'Bug fixes and improvements.',
    pubDate: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    platforms,
  };

  const outPath = path.resolve(args.out || `releases/v${args.version}/updates.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n');

  console.log(`\n=== Written ===`);
  console.log(`   ${outPath}`);
  console.log(`   platforms: ${Object.keys(platforms).join(', ')}`);
  for (const [k, v] of Object.entries(platforms)) {
    console.log(`     ${k.padEnd(16)} ${v.url.split('/').pop()}`);
  }
  console.log('');
}

main().catch((e) => die(e.stack || e.message));
