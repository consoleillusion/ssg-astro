import fs from 'node:fs';
import { createRequire } from 'node:module';

const themeSpecifiers: Record<string, string> = {
	sakura: 'sakura.css',
	milligram: 'milligram',
	skeleton: 'skeleton-css/css/skeleton.css',
};

export async function GET() {
	const theme = (process.env.SSG_CLASSLESS ?? '').trim().toLowerCase();
	const specifier = themeSpecifiers[theme];

	if (!specifier) {
		return new Response('Not found', { status: 404 });
	}

	try {
		const require = createRequire(import.meta.url);
		const stylesheet = fs.readFileSync(require.resolve(specifier));

		return new Response(stylesheet, {
			headers: { 'Content-Type': 'text/css; charset=utf-8' },
		});
	} catch {
		return new Response(`Could not load the "${theme}" classless stylesheet. Run the install step again.`, {
			status: 500,
			headers: { 'Content-Type': 'text/plain; charset=utf-8' },
		});
	}
}
