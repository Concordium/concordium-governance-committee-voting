#!/bin/bash

# Check if signing is enabled
if [ "$SIGN" != "1" ]; then
  echo "Skipping signing."
  exit 0
fi

# Ensure that WINDOWS_SM_KEYPAIR_ALIAS and WINDOWS_PKCS11_CONFIG are set in the environment
if [ -z "$WINDOWS_SM_KEYPAIR_ALIAS" ] || [ -z "$WINDOWS_PKCS11_CONFIG" ]; then
  echo "Error: WINDOWS_SM_KEYPAIR_ALIAS and WINDOWS_PKCS11_CONFIG environment variables must be set."
  exit 1
fi

if [ -z "$1" ]; then
  echo "Error: No input path provided."
  exit 1
fi

# Assign environment variables to script variables
KEYPAIR_ALIAS=$WINDOWS_SM_KEYPAIR_ALIAS
CONFIG=$WINDOWS_PKCS11_CONFIG
INPUT=$1

# Execute the signing command
smctl sign --keypair-alias "$KEYPAIR_ALIAS" --input "$INPUT" --config-file "$CONFIG" --verbose --exit-non-zero-on-fail --failfast
