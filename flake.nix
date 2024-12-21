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
          echo "hi"
          echo "copying from store"
          mkdir -p ${cacheDir}
          rsync -rv --delete ${self.packages.${system}.default}/* ${cacheDir}
          ls 
          curdir=$(pwd)
          echo "curdir: $curdir"
          echo "cachedir: ${cacheDir}"
          echo "ln -s $curdir ${cacheDir}/src/pages"
          chmod -R 755 ${cacheDir}
          ln -s "$curdir" ${cacheDir}/src/pages
        '';
      };
      serve = pkgs.writeShellApplication {
        name = "serve";
        runtimeInputs = [pkgs.nodejs];
        text = ''
          cd ${cacheDir}
          npm install
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
