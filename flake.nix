{
  description = "Flake that copies a template folder and makes a script";

  outputs = { self, nixpkgs }:
  let
    system = "x86_64-linux";
    pkgs = nixpkgs.legacyPackages.${system};
    cacheDir = "/tmp/astro-ssg";
  in {
    packages.${system} = {
      default = pkgs.stdenv.mkDerivation {
        pname = "init";
        version = "0.0.1";
        src = ./.;
        nativeBuildInputs = [pkgs.rsync];
        installPhase = ''
          mkdir -p $out/bin
          echo "copying to store"
          echo $out > "$out/text.txt"
          rsync -rv $src/template/* $out/
        '';
      };
      init = pkgs.writeShellApplication {
        name = "init";
        runtimeInputs = [pkgs.rsync];
        text = ''
          no_default_page=0

          for arg in "$@"; do
            case "$arg" in
              --no-default-page)
                no_default_page=1
                ;;
              -h|--help)
                echo "Usage: init [--no-default-page]"
                echo
                echo "  --no-default-page  Do not provide the missing-index page at /."
                exit 0
                ;;
              *)
                echo "Unknown argument: $arg" >&2
                exit 1
                ;;
            esac
          done

          echo "copying template to ${cacheDir}"
          mkdir -p ${cacheDir}
          rsync -r --delete ${self.packages.${system}.default}/* ${cacheDir}

          curdir=$(pwd)
          pages_dir="${cacheDir}/src/pages"
          echo "serving $curdir as $pages_dir"

          chmod -R 755 ${cacheDir}
          rm -rf "$pages_dir"
          ln -s "$curdir" "$pages_dir"

          marker="${cacheDir}/.no-default-page"
          rm -f "$marker"

          if [ "$no_default_page" -eq 1 ]; then
            : > "$marker"
          fi

          if [ -e "$curdir/index.astro" ] || [ -e "$curdir/index.html" ] || [ -e "$curdir/index.md" ] || [ -e "$curdir/index.mdx" ]; then
            echo "Found an index page; / will serve it."
          elif [ "$no_default_page" -eq 1 ]; then
            echo "No index page found; / will return 404 (default page disabled)."
          else
            echo "No index page found; / will show a page describing the supported file types."
          fi
        '';
      };
      serve = pkgs.writeShellApplication {
        name = "serve";
        runtimeInputs = [pkgs.nodejs_24];
        text = ''
          no_default_page=0

          for arg in "$@"; do
            case "$arg" in
              --no-default-page)
                no_default_page=1
                ;;
              -h|--help)
                echo "Usage: serve [--no-default-page]"
                echo
                echo "  --no-default-page  Do not provide the missing-index page at /."
                exit 0
                ;;
              *)
                echo "Unknown argument: $arg" >&2
                exit 1
                ;;
            esac
          done

          cd ${cacheDir}
          npm install

          if [ "$no_default_page" -eq 1 ]; then
            SSG_NO_DEFAULT_PAGE=1 npm run dev
          else
            npm run dev
          fi
        '';
      };
    };

    apps.${system}.default = {
      type = "app";
      program = "${self.packages.${system}.init}/bin/init";
    };

  };
}

/*
#!/usr/bin/env bash
#rootdir=$(pwd)
#echo 'echo "Hello from mkDerivation!"' >> $out/bin/init
#echo "echo \"Template files are in $out/template\"" >> $out/bin/init
#out=$1

#echo "cd ." >> $out/bin/init
#echo "ln -s . ./.:sg/src/pages" >> $out/bin/init
#echo "cd ./.ssg" >> $out/bin/init
#echo "chmod 755 -R ." >> $out/bin/init
#echo "npm install" >> $out/bin/init
##echo "pwd" >> $out/bin/init
##echo "npm run dev" >> $out/bin/init
#echo "echo \"pwd: $rootdir\"" >> $out/bin/init
#chmod +x $out/bin/init

#pwd
#echo "echo \"ln -s .. ./.ssg/src/pages\""  >> $out/bin/init
*/
