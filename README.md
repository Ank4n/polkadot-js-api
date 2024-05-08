# polkadot-js-api-ts-template

Run with 
```bash
yarn run main -e "wss://polkadot-rpc.dwellir.com"
```

## Corrupt ledgers
```bash
yarn run test:corrupt_ledgers -e "wss://kusama-rpc.dwellir.com"
yarn run test:corrupt_ledgers -e "wss://polkadot-rpc.dwellir.com"
```

## Validators with unclaimed rewards
```bash
yarn run test:unclaimed_reward_pages -e 'wss://kusama-rpc.dwellir.com' -r 6593
```

See [`package.json`](./package.json) to see what's up 🔥🔥.

