# in flake.nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    rust-overlay.url = "github:oxalica/rust-overlay";
  };
  outputs = { self, nixpkgs, flake-utils, rust-overlay }:
    flake-utils.lib.eachDefaultSystem
      (system:
        let
          overlays = [ (import rust-overlay) ];
          pkgs = import nixpkgs {
            inherit system overlays;
          };
        in
        with pkgs;
        {
          devShells.default = mkShell {
            nativeBuildInputs = [ pkg-config ];
            buildInputs = [
              pkg-config
              rust-bin.stable."1.76.0".default
              openssl
              #libsoup
              #webkitgtk
            ];
            LD_LIBRARY_PATH = lib.makeLibraryPath [ openssl ];
          };
        }
      );
}
