import fs from 'node:fs';

export async function GET() {
	const file = (process.env.SSG_CSS_PATH ?? '').trim();

	if (!file) {
		return new Response('Not found', { status: 404 });
	}

	try {
		// Read on every request so edits are picked up without a restart.
		const stylesheet = fs.readFileSync(file);

		return new Response(stylesheet, {
			headers: { 'Content-Type': 'text/css; charset=utf-8' },
		});
	} catch {
		return new Response(`Could not read the CSS file passed via --css: "${file}"`, {
			status: 500,
			headers: { 'Content-Type': 'text/plain; charset=utf-8' },
		});
	}
}
