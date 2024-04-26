## 1.0.0

- Add parameters used to generate eligible voters list to `InitParams` and correspondingly the contract state.
- Change `ElectionConfig` to include guardian accounts instead of keys, as guardian keys cause the size to increase by a lot.
- Allow admin role to reset finalization phase anytime after `election_end` (previously anytime after `decryption_deadline`)

## 0.1.0

- Initial version of election contract
