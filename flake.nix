{
  description = "Serve a directory of static web files with Astro";

  outputs = { self, nixpkgs }:
  let
    system = "x86_64-linux";
    pkgs = nixpkgs.legacyPackages.${system};

    # CLI dependencies, installed from the committed package-lock.json.
    # Node/npm is only needed to build the store path; the runtime runs on Bun.
    # Dev dependencies are omitted: the CLI only needs cac, compare-versions,
    # and tinyglobby, and typescript's patched shebangs would otherwise pull
    # the whole Node runtime into the Bun closure.
    nodeDeps = pkgs.importNpmLock.buildNodeModules {
      npmRoot = self;
      nodejs = pkgs.nodejs_24;
      derivationArgs = { npmFlags = [ "--omit=dev" ]; };
    };

    astroSsg = pkgs.stdenv.mkDerivation {
      pname = "astro-ssg";
      version = "0.1.1";
      src = self;
      dontBuild = true;
      installPhase = ''
        mkdir -p $out
        cp -r bin template package.json $out/
        ln -s ${nodeDeps}/node_modules $out/node_modules
      '';
    };

    # Thin wrapper: every argument goes straight to the Bun-run CLI (cac), so
    # the Nix entry point accepts exactly the same interface as `astro-ssg serve`.
    serve = pkgs.writeShellApplication {
      name = "serve";
      runtimeInputs = [ pkgs.bun ];
      text = ''exec bun "${astroSsg}/bin/astro-ssg.js" serve "$@"'';
    };

    app = {
      type = "app";
      program = "${serve}/bin/serve";
    };
  in {
    packages.${system} = { default = serve; inherit serve; };

    apps.${system} = { default = app; serve = app; };
  };
}
