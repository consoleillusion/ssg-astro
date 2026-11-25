# Console
<!--raw-typst <ref-console> -->


Status: **Implemented**.

The `console` command serves a browser page for using a server without writing a
client: connect to it, register, log in, and read and change resources. It uses
the same secure client as any application (`createSecureClient`), so every
request goes through the Noise transport and, after login, is signed.

## Running it


The quickest way, from the repository root:

```bash
bun run try
```

It starts a throwaway server and the console together and prints a link with
the server URL and fingerprint already filled in ([Development](#ref-development)). Press
*Connect*, then register.

Against a server of your own, add the console's origin to the server's
settings, `SRS_CORS_ORIGINS=http://127.0.0.1:5735`, restart it, and run:

```bash
bun src/cli.ts console      # bunx srs console where SRS is a dependency
```

Open `http://127.0.0.1:5735`, enter the server URL and the fingerprint printed
by `init`, and press *Connect*. A link can fill both in:
`http://127.0.0.1:5735/?server=http://10.0.0.5:5734&pin=srs1:…`.

| **Option** | **Meaning** |
| --- | --- |
| `--port` | Port of the page; `5735` by default. |
| `--host` | Address to listen on; `127.0.0.1` by default, so only this machine can open it. Use `0.0.0.0` to open it from another machine, and add that origin (`http://<address>:5735`) to `SRS_CORS_ORIGINS`. |


The page and the API are on different ports, so they are different origins and
the browser needs `SRS_CORS_ORIGINS` to let the page call the server. The
command prints the exact value.

## What it does


- **Server.** Connect with a URL and a pinned fingerprint. _Trust key from
  server_ fills in the fingerprint the server reports; use it only on a network
  you trust, since it is the step pinning protects. A signed key rotation
  updates the pin automatically.
- **Account.** Register, log in and log out. Servers in strict mode list their
  resources only after login. The password is never stored; the
  server URL, fingerprint and username are kept in the browser between visits.
- **Explorer.** Choose a resource from the catalog. *List*, *Get*, *Create*,
  *Update* and *Delete* run the matching JSON:API request; *Template* fills in a
  document with the resource's writable attributes and relations. Any other
  request can be sent with a method and a path, such as
  `/article?filter[status]=draft&include=author`.
- **Requests.** Every request is logged with its status and time; the response
  body is shown in full.

## Trust


The page is served by your own machine. It is only as trustworthy as the
origin it is loaded from ([Threat model](#threat-model)): do not serve it over a network you do
not trust. It works on plain-HTTP pages, where browsers withhold
`crypto.subtle`, because the client uses pure JavaScript cryptography.

## Tests


`spec/browser.test.ts` runs `bun run try` as a process and drives the console in
headless Chrome through connect, register, create, update, list, a raw request,
delete, logout and login: once on `127.0.0.1`, and once on the machine's LAN
address over plain HTTP, where the page has no `crypto.subtle`. It is skipped
when no Chrome is found; `CHROME_PATH` points it at one.
