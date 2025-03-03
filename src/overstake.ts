// needed as of 7.x series, see CHANGELOG of the api repo.
import '@polkadot/api-augment';
import '@polkadot/types-augment';

import { ApiPromise, WsProvider } from '@polkadot/api';
import { ApiDecoration } from '@polkadot/api/types';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const optionsPromise = yargs(hideBin(process.argv)).option('endpoint', {
	alias: 'e',
	type: 'string',
	default: 'wss://polkadot-rpc.dwellir.com',
	description: 'the wss endpoint. It must allow unsafe RPCs.',
	required: true
}).argv;

const DECIMALS = 1e10;

// Over-stake
// Check ledger balance, then user free balance, and if free balance < ledger balance, print out diff.
async function main() {
	const options = await optionsPromise;
	const provider = new WsProvider(options.endpoint);
	const api = await ApiPromise.create({ provider });

	const current_era = (await api.query.staking.currentEra()).unwrap().toNumber();
	const ledgers = await api.query.staking.ledger.entries();

	console.log(`\n## Overstake table \n`);
	console.log(`Current era: ${current_era}\n`);
	console.log(`Ledger count: ${ledgers.length}  \n`);
	console.log(`| Stash | Ledger Total | Free Balance | Diff/1e10 |`);
	console.log(`|------------|-----------|-----------|-----------|`);
	for (const l of ledgers) {
		if (l[1].isEmpty) continue;
		const ledger = l[1].unwrap();
		const free_balance = (await api.query.system.account(ledger.stash)).data.free;

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
