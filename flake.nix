{
  description = "Serve a directory of static web files with Astro";

  outputs = { self, nixpkgs }:
  let
    system = "x86_64-linux";
    pkgs = nixpkgs.legacyPackages.${system};

    # CLI dependencies, installed from the committed package-lock.json.
    nodeDeps = pkgs.importNpmLock.buildNodeModules {
      npmRoot = self;
      nodejs = pkgs.nodejs_24;
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

    # Thin wrapper: every argument goes straight to the Node CLI (cac), so the
    # Nix entry point accepts exactly the same interface as `astro-ssg serve`.
    serve = pkgs.writeShellApplication {
      name = "serve";
      runtimeInputs = [ pkgs.nodejs_24 ];
      text = ''exec node "${astroSsg}/bin/astro-ssg.js" serve "$@"'';
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
