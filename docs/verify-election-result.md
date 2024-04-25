# Verifying an election result as a third party

This document describes the process of verifying the result registered in an election contract. The easiest way to do this, is to
use the `election-coordinator` tool to verify the steps executed by the _election coordinator_ registered as `admin` in the election contract.

## Verify correct computation of voting weights

Before setting up the election contract, the election coordinator calculates the _voting weight_ assocatied with each account. This weight is
used to scale the ballots submitted by voting accounts. As such, it is critical that these are correctly calculated.

To verify the weight computation, run the following command with the election coordinator tool

```bash
election-coordinator initial-weights --out initial-weights-data verify --node "https://grpc.testnet.concordium.com:20000" --contract "<8836,0>" 
```

Where:
- `initial-weights-data` is replaced with path to the directory to output the files containing the weights computation and corresponding
  parameters into
- `"<8836,0>"` is replaced with the contract address of the target election contract.
- `"https://grpc.testnet.concordium.com:20000"` is replaced with a node on the target network.

## Verify correct computation of encrypted tally

The next step to verify, is that the election tally is correctly computed. This is a two step process due to the fact that the voting weight
associated to an account can be delegated to another account. As such, a final pass has to be done on the voting weights prior to tallying
the election ballots. The final weights are then used to scale the election ballots submitted by each account when tallying.

The encrypted tally is used by the _election guardians_, who each decrypt their own share of the encrypted tally and register this
decryption share along with a proof of correct decryption in the election contract.

### Compute the final weights

To compute the final weights of the election, execute the following command:

```bash
election-coordinator final-weights final-weights --contract "<8836,0>" --initial-weights initial-weights.csv --final-weights final-weights.csv
```

Where:
- `"<8836,0>"` is replaced with the contract address of the target election contract.
- `initial-weights.csv` is replaced by the location of the file containing the initial weights on your machine.
- `final-weights.csv` is replaced by a location on your machine where the final weights should be written.

This file can be reviewed to ensure the expected delegations have been correctly included.

### Compute the election tally

To compute the election tally, execute the following command:

```bash
election-coordinator tally --contract "<8836,0>" --final-weights final-weights.csv
```

Where:
- `"<8836,0>"` is replaced with the contract address of the target election contract.
- `final-weights.csv` is replaced by the location of the file containing the final weights on your machine (from the previous step).

## Verify correct decryption of election tally

The final step consists of the election coordinator combining the decryption shares registered by each guardian. Verification of 
the computed election result can be achieved by executing the folowing command:

```bash
election-coordinator final-result --contract "<8836,0>"
```

Where:
- `"<8836,0>"` is replaced with the contract address of the target election contract.

## Conclusion

If all steps succeed, the election process and result has now been successfully verified.
