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
          classless=""

          while [ $# -gt 0 ]; do
            case "$1" in
              --no-default-page)
                no_default_page=1
                shift
                ;;
              --classless)
                if [ $# -gt 1 ] && [ "''${2#-}" = "$2" ]; then
                  classless="$2"
                  shift 2
                else
                  classless="sakura"
                  shift
                fi
                ;;
              --classless=*)
                classless="''${1#--classless=}"
                shift
                ;;
              -h|--help)
                echo "Usage: init [--no-default-page] [--classless [theme]]"
                echo
                echo "  --no-default-page  Do not provide the missing-index page at /."
                echo "  --classless        Style every route with a classless stylesheet."
                echo "                     Themes: sakura (default), milligram, skeleton."
                exit 0
                ;;
              *)
                echo "Unknown argument: $1" >&2
                exit 1
                ;;
            esac
          done

          case "$classless" in
            ""|sakura|milligram|skeleton) ;;
            *)
              echo "Unknown classless theme \"$classless\". Choose one of: sakura, milligram, skeleton." >&2
              exit 1
              ;;
          esac

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

          classless_marker="${cacheDir}/.classless"
          rm -f "$classless_marker"

          if [ -n "$classless" ]; then
            printf '%s' "$classless" > "$classless_marker"
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
          no_default_page_set=0
          classless=""

          while [ $# -gt 0 ]; do
            case "$1" in
              --no-default-page)
                no_default_page=1
                no_default_page_set=1
                shift
                ;;
              --classless)
                if [ $# -gt 1 ] && [ "''${2#-}" = "$2" ]; then
                  classless="$2"
                  shift 2
                else
                  classless="sakura"
                  shift
                fi
                ;;
              --classless=*)
                classless="''${1#--classless=}"
                shift
                ;;
              -h|--help)
                echo "Usage: serve [--no-default-page] [--classless [theme]]"
                echo
                echo "  --no-default-page  Do not provide the missing-index page at /."
                echo "  --classless        Style every route with a classless stylesheet."
                echo "                     Themes: sakura (default), milligram, skeleton."
                exit 0
                ;;
              *)
                echo "Unknown argument: $1" >&2
                exit 1
                ;;
            esac
          done

          if [ -z "$classless" ] && [ -f "${cacheDir}/.classless" ]; then
            classless=$(cat "${cacheDir}/.classless")
          fi

          case "$classless" in
            ""|sakura|milligram|skeleton) ;;
            *)
              echo "Unknown classless theme \"$classless\". Choose one of: sakura, milligram, skeleton." >&2
              exit 1
              ;;
          esac

          if [ "$no_default_page_set" -eq 0 ] && [ -e "${cacheDir}/.no-default-page" ]; then
            no_default_page=1
          fi

          cd ${cacheDir}
          npm install

          if [ "$no_default_page" -eq 1 ]; then
            export SSG_NO_DEFAULT_PAGE=1
          fi

          if [ -n "$classless" ]; then
            export SSG_CLASSLESS="$classless"
          fi

          npm run dev
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
