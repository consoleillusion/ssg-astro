#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const templateDir = path.join(packageRoot, 'template');
const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));

const MINIMUM_NODE = [22, 23, 4];
const INDEX_FILES = ['index.astro', 'index.html', 'index.md', 'index.mdx'];

function fail(message) {
	console.error(`astro-ssg: ${message}`);
	process.exit(1);
}

function defaultCacheDir() {
	if (process.env.ASTRO_SSG_CACHE) {
		return path.resolve(process.env.ASTRO_SSG_CACHE);
	}

	if (process.platform === 'win32') {
		const localAppData = process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local');
		return path.join(localAppData, 'astro-ssg');
	}

	const cacheRoot = process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), '.cache');
	return path.join(cacheRoot, 'astro-ssg');
}

const CACHE_DIR = defaultCacheDir();
const PAGES_DIR = path.join(CACHE_DIR, 'src', 'pages');
const MARKER_PATH = path.join(CACHE_DIR, '.no-default-page');

function help() {
	console.log(`astro-ssg ${packageJson.version}

Serve a directory of Astro, HTML, Markdown, and MDX files.

Usage:
  astro-ssg init [--no-default-page]
  astro-ssg serve [--no-default-page] [--port <port>] [--host [host]]

Commands:
  init    Copy the Astro template to the cache and link the current
          directory as its src/pages directory.
  serve   Install dependencies and start the Astro dev server.

Options:
  --no-default-page  Do not provide the missing-index page at /.
  --port <port>      Port for the dev server.
  --host [host]      Expose the dev server on the network.
  -h, --help         Show this help.
  -v, --version      Show the version.

Cache:
  ${CACHE_DIR}
  Set ASTRO_SSG_CACHE to use a different directory.`);
}

function checkNodeVersion() {
	const current = process.versions.node.split('.').map(Number);
	const [major, minor, patch] = current;
	const [requiredMajor, requiredMinor, requiredPatch] = MINIMUM_NODE;
	const supported =
		major > requiredMajor ||
		(major === requiredMajor &&
			(minor > requiredMinor || (minor === requiredMinor && patch >= requiredPatch)));

	if (!supported) {
		fail(
			`Node.js ${MINIMUM_NODE.join('.')} or newer is required; found ${process.versions.node}.`,
		);
	}
}

function parseOptions(argv, { allowServeOptions = false } = {}) {
	const options = {
		help: false,
		version: false,
		noDefaultPage: false,
		port: null,
		host: null,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		if (arg === '-h' || arg === '--help') {
			options.help = true;
		} else if (arg === '-v' || arg === '--version') {
			options.version = true;
		} else if (arg === '--no-default-page') {
			options.noDefaultPage = true;
		} else if (allowServeOptions && (arg === '--port' || arg === '-p')) {
			const value = argv[index + 1];
			if (!value || value.startsWith('-')) {
				fail('--port requires a value.');
			}
			options.port = value;
			index += 1;
		} else if (allowServeOptions && arg.startsWith('--port=')) {
			options.port = arg.slice('--port='.length);
		} else if (allowServeOptions && arg === '--host') {
			const value = argv[index + 1];
			if (value && !value.startsWith('-')) {
				options.host = value;
				index += 1;
			} else {
				options.host = '0.0.0.0';
			}
		} else if (allowServeOptions && arg.startsWith('--host=')) {
			options.host = arg.slice('--host='.length);
		} else {
			fail(`unknown argument: ${arg}`);
		}
	}

	if (options.port !== null && !/^\d+$/.test(options.port)) {
		fail('--port must be a number.');
	}

	return options;
}

function removePath(target) {
	try {
		const stat = fs.lstatSync(target);
		if (stat.isDirectory() && !stat.isSymbolicLink()) {
			fs.rmSync(target, { recursive: true, force: true });
		} else {
			fs.unlinkSync(target);
		}
	} catch (error) {
		if (error.code !== 'ENOENT') {
			throw error;
		}
	}
}

function assertCacheIsSafe(serveDir) {
	const cache = path.resolve(CACHE_DIR);
	const served = path.resolve(serveDir);

	if (
		served === cache ||
		served.startsWith(`${cache}${path.sep}`) ||
		cache.startsWith(`${served}${path.sep}`)
	) {
		fail(
			'The cache directory and the served directory must not contain each other. Set ASTRO_SSG_CACHE somewhere else.',
		);
	}
}

function init(options) {
	checkNodeVersion();

	const serveDir = process.cwd();
	assertCacheIsSafe(serveDir);

	console.log(`copying template to ${CACHE_DIR}`);
	fs.rmSync(CACHE_DIR, { recursive: true, force: true });
	fs.mkdirSync(CACHE_DIR, { recursive: true });
	fs.cpSync(templateDir, CACHE_DIR, { recursive: true });

	fs.mkdirSync(path.dirname(PAGES_DIR), { recursive: true });
	removePath(PAGES_DIR);
	fs.symlinkSync(serveDir, PAGES_DIR, process.platform === 'win32' ? 'junction' : 'dir');

	console.log(`serving ${serveDir} as ${PAGES_DIR}`);

	if (options.noDefaultPage) {
		fs.writeFileSync(MARKER_PATH, '');
	} else {
		fs.rmSync(MARKER_PATH, { force: true });
	}

	const hasIndexPage = INDEX_FILES.some((file) => fs.existsSync(path.join(serveDir, file)));

	if (hasIndexPage) {
		console.log('Found an index page; / will serve it.');
	} else if (options.noDefaultPage) {
		console.log('No index page found; / will return 404 (default page disabled).');
	} else {
		console.log('No index page found; / will show a page describing the supported file types.');
	}
}

function run(command, args, options = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			stdio: 'inherit',
			shell: process.platform === 'win32',
			...options,
		});

		child.on('error', reject);
		child.on('close', (code, signal) => {
			resolve(code ?? (signal ? 1 : 0));
		});
	});
}

async function serve(options) {
	checkNodeVersion();
	assertCacheIsSafe(process.cwd());

	if (!fs.existsSync(path.join(CACHE_DIR, 'package.json')) || !fs.existsSync(PAGES_DIR)) {
		console.log('No template cache found; initializing it for this directory.');
		init(options);
	} else {
		const serveDir = fs.realpathSync(process.cwd());
		const linkedDir = fs.realpathSync(PAGES_DIR);

		if (serveDir !== linkedDir) {
			fail(
				`The cache is configured to serve ${linkedDir}. Run "astro-ssg init" from the directory you want to serve, or set ASTRO_SSG_CACHE to a different cache.`,
			);
		}
	}

	const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
	const env = { ...process.env };

	if (options.noDefaultPage) {
		env.SSG_NO_DEFAULT_PAGE = '1';
	}

	console.log('installing dependencies');
	let exitCode = await run(npm, ['install', '--no-audit', '--no-fund'], {
		cwd: CACHE_DIR,
		env,
	});

	if (exitCode !== 0) {
		process.exitCode = exitCode;
		return;
	}

	const astroArgs = [];
	if (options.port !== null) {
		astroArgs.push('--port', options.port);
	}
	if (options.host !== null) {
		astroArgs.push('--host', options.host);
	}

	const devArgs = ['run', 'dev'];
	if (astroArgs.length > 0) {
		devArgs.push('--', ...astroArgs);
	}

	exitCode = await run(npm, devArgs, {
		cwd: CACHE_DIR,
		env,
	});
	process.exitCode = exitCode;
}

async function main() {
	const [command, ...args] = process.argv.slice(2);

	if (command === undefined || command === '-h' || command === '--help') {
		help();
		return;
	}

	if (command === '-v' || command === '--version') {
		console.log(packageJson.version);
		return;
	}

	if (command === 'init') {
		const options = parseOptions(args);
		if (options.help) {
			help();
			return;
		}
		if (options.version) {
			console.log(packageJson.version);
			return;
		}
		init(options);
		return;
	}

	if (command === 'serve') {
		const options = parseOptions(args, { allowServeOptions: true });
		if (options.help) {
			help();
			return;
		}
		if (options.version) {
			console.log(packageJson.version);
			return;
		}
		await serve(options);
		return;
	}

	fail(`unknown command: ${command}. Run "astro-ssg --help" for usage.`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
