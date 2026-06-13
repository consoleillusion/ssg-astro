// @ts-check
/*
 * The pages directory is a symlink to the directory being served. Astro
 * warns once per React/Vue/Svelte component file it finds there ("Only
 * Astro files can be used as pages ..."), which can be hundreds of lines of
 * unactionable output. Drop exactly those messages; everything else goes to
 * the standard Node logger.
 */
import nodeLogger from 'astro/logger/node';

/** @type {RegExp} */
const FILTERED = /Unsupported file type|Only Astro files can be used as pages/;

export default function quietPagesLogger(options) {
	const destination = nodeLogger(options);
	return {
		/** @param {{ label: string | null, level: string, message: string, newLine: boolean }} event */
		write(event) {
			if (event.level === 'warn' && FILTERED.test(event.message)) {
				return;
			}
			destination.write(event);
		},
		flush: destination.flush?.bind(destination),
		close: destination.close?.bind(destination),
	};
}
