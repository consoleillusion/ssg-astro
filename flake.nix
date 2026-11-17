{
  description = "Serve a directory of static web files with Astro";

  outputs = { self, nixpkgs }:
  let
    system = "x86_64-linux";
    pkgs = nixpkgs.legacyPackages.${system};

    # Fetch the five production dependencies directly (they mirror
    # package-lock.json) and bundle the CLI with Bun, so neither npm, Node,
    # nor python are needed at build time. The published npm package is
    # unaffected; this only affects the Nix build.
    # Keep these in sync with package-lock.json.
    cacTgz = pkgs.fetchurl {
      url = "https://registry.npmjs.org/cac/-/cac-6.7.14.tgz";
      hash = "sha512-b6Ilus+c3RrdDk+JhLKUAQfzzgLEPy6wcXqS7f/xe1EETvsDP6GORG7SFuOs6cID5YkqchW/LXZbX5bc8j7ZcQ==";
    };
    compareVersionsTgz = pkgs.fetchurl {
      url = "https://registry.npmjs.org/compare-versions/-/compare-versions-6.1.1.tgz";
      hash = "sha512-4hm4VPpIecmlg59CHXnRDnqGplJFrbLG4aFEl5vl6cK1u76ws3LLvX7ikFnTDl5vo39sjWD6AaDPYodJp/NNHg==";
    };
    tinyglobbyTgz = pkgs.fetchurl {
      url = "https://registry.npmjs.org/tinyglobby/-/tinyglobby-0.2.17.tgz";
      hash = "sha512-wXR/dYpcqKmfWpEdZjiKJOwCNFndD0DMnrW/cYjVGttEkBfVgcLFHoNrlj47mjOVic9yyNu65alsgF4NQyTa2g==";
    };
    fdirTgz = pkgs.fetchurl {
      url = "https://registry.npmjs.org/fdir/-/fdir-6.5.0.tgz";
      hash = "sha512-tIbYtZbucOs0BRGqPJkshJUYdL+SDH7dVM8gjy+ERp3WAUjLEFJE+02kanyHtwjWOnwrKYBiwAmM0p4kLJAnXg==";
    };
    picomatchTgz = pkgs.fetchurl {
      url = "https://registry.npmjs.org/picomatch/-/picomatch-4.0.7.tgz";
      hash = "sha512-qcJu88Q2IWqJsDD529JKMdwGm/dvInW4HvQnRwiH9JtihJvzGOscDtHE3x1pBKeUOTysQ8kVmLnJ2kJu7yhcGA==";
    };

    astroSsg = pkgs.stdenv.mkDerivation {
      pname = "astro-ssg";
      version = "0.1.1";
      src = self;
      nativeBuildInputs = [ pkgs.bun ];
      dontBuild = true;
      installPhase = ''
        mkdir -p node_modules/cac node_modules/compare-versions node_modules/tinyglobby \
                   node_modules/fdir node_modules/picomatch $out/bin
        tar -xzf ${cacTgz} --strip-components=1 -C node_modules/cac
        tar -xzf ${compareVersionsTgz} --strip-components=1 -C node_modules/compare-versions
        tar -xzf ${tinyglobbyTgz} --strip-components=1 -C node_modules/tinyglobby
        tar -xzf ${fdirTgz} --strip-components=1 -C node_modules/fdir
        tar -xzf ${picomatchTgz} --strip-components=1 -C node_modules/picomatch
        bun build bin/astro-ssg.js --target=bun --outfile=$out/bin/astro-ssg.js
        cp -r template $out/template
        cp package.json $out/package.json
      '';
    };

    # Thin wrapper for arbitrary CLI invocations: every argument goes
    # straight to the CLI untouched, so new commands work without touching
    # this file.
    astroSsgCli = pkgs.writeShellApplication {
      name = "astro-ssg";
      runtimeInputs = [ pkgs.bun ];
      text = ''exec bun "${astroSsg}/bin/astro-ssg.js" "$@"'';
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

    cliApp = {
      type = "app";
      program = "${astroSsgCli}/bin/astro-ssg";
    };
  in {
    packages.${system} = { default = serve; inherit serve; astro-ssg = astroSsgCli; };

    apps.${system} = { default = app; serve = app; astro-ssg = cliApp; };
  };
}
