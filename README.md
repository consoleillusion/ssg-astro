# astro-ssg

Serve a directory with Astro. Run these commands from the directory you want to serve:

```bash
nix run github:consoleillusion/ssg-astro#init
nix run github:consoleillusion/ssg-astro#serve
```

`init` copies a small Astro project to `/tmp/astro-ssg` and links the current directory as its `src/pages` directory. `serve` installs dependencies and starts the Astro dev server.

Files are routed using Astro's file-based routing:

| File              | URL          |
| :---------------- | :----------- |
| `index.md`        | `/`          |
| `about.md`        | `/about`     |
| `blog/post.mdx`   | `/blog/post` |
| `index.astro`     | `/`          |
| `about.html`      | `/about`     |
| `docs/index.html` | `/docs/`     |

Only `.astro`, `.html`, `.md`, and `.mdx` files are pages. Other files are ignored by the router. HTML pages are served as-is and do not go through Astro's renderer.

If the directory has no `index.astro`, `index.html`, `index.md`, or `index.mdx`, `/` shows a generated listing of the available pages. If you add an index page while `serve` is running, restart it so Astro stops using the fallback listing.
