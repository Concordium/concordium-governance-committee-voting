## Unreleased

### Breaking changes

- Removed `--node` cli flag, as the target node can now be configured through the user configuration file
- Store guardian data on a path on disk derived from the user configuration. Specifically, this means the data will be
  stored at `$APPDATA/<network>/<contract-address>/<account-address>` for each guardian.

### Changes

- Bumped rust-sdk dependency to 6.0
- Update `@concordium/web-sdk` to 9.1.
- Added configuration by user config file, allowing users to configure the network/contract to integrate with. This can
  be accessed from the "Settings" menu from the native application menu


## 1.0.0

- Improve dialogue on guardian action modal
- Improve error message when requests to get remote resources fail.
- Updates wording of unlock dialog
- Make it possible to override the node endpoint to use through `--node` command line argument
- Add note that manual intervention is required to errors when failing to generate proof of decryption
- Add "Incomplete" and "Done" steps to tally phase UI, to better guide guardians.

## 0.1.2

- Updates concordium rust dependencies

## 0.1.1

- Includes various minor fixes

## 0.1.0

- Initial version
