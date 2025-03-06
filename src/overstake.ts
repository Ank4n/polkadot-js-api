// needed as of 7.x series, see CHANGELOG of the api repo.
import '@polkadot/api-augment';
import '@polkadot/types-augment';

import { ApiPromise, WsProvider } from '@polkadot/api';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const optionsPromise = yargs(hideBin(process.argv))
	.option('endpoint', {
		alias: 'u',
		type: 'string',
		default: 'ws://localhost:9900',
		description: 'the wss endpoint. It must allow unsafe RPCs.',
		demandOption: true
	})
	.option('block', {
		alias: 'b',
		type: 'number',
		default: '-1',
		description: 'the block height to query',
		demandOption: false
	}).argv;

const DECIMALS = 1e10;

// Detect Over-staking accounts
//
// Usage:
// Run this script using the following command:
//
// `yarn run test:overstake -u "<RPC_URL>" -b <BLOCK_NUMBER>`
async function main() {
	const options = await optionsPromise;
	console.log(`Options: ${options.endpoint}, ${options.block}`);
	const provider = new WsProvider(options.endpoint);
	const api = await ApiPromise.create({ provider });
	let queryBlock = options.block;
	if (queryBlock < 0) {
		queryBlock = (await api.derive.chain.bestNumber()).toNumber();
	}

	const queryHash = await api.rpc.chain.getBlockHash(queryBlock);
	const apiAt = await api.at(queryHash);

	const ledgers = await apiAt.query.staking.ledger.entries();

	console.log(`\n## Overstake table \n`);
	console.log(`Querying at Block: ${queryBlock}\n`);
	console.log(`Total ledger count: ${ledgers.length}  \n`);

	console.log(`| Stash | Ledger Total | Free Balance | Diff/1e10 |`);
	console.log(`|------------|-----------|-----------|-----------|`);

	for (const l of ledgers) {
		if (l[1].isEmpty) continue;
		const ledger = l[1].unwrap();
		const is_virtual_staker = await apiAt.query.staking.virtualStakers(ledger.stash);
		if (is_virtual_staker.isSome) {
			// skip virtual stakers
			continue;
		}

		const free_balance = (await apiAt.query.system.account(ledger.stash)).data.free;

		if (ledger.total.toBigInt() - free_balance.toBigInt() > 0) {
			console.log(
				`| ${ledger.stash} | ${ledger.total.toBigInt()} | ${free_balance.toBigInt()} | ${
					(ledger.total.toBigInt() - free_balance.toBigInt()) / BigInt(DECIMALS)
				} |`
			);
		}
	}

	process.exit(0);
}

main().catch(console.error);
