// needed as of 7.x series, see CHANGELOG of the api repo.
import '@polkadot/api-augment';
import '@polkadot/types-augment';

import { ApiPromise, WsProvider } from '@polkadot/api';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const optionsPromise = yargs(hideBin(process.argv)).option('endpoint', {
	alias: 'e',
	type: 'string',
	default: 'wss://polkadot-rpc.dwellir.com',
	description: 'the wss endpoint. It must allow unsafe RPCs.',
	required: true
}).argv;

async function main() {
	const options = await optionsPromise;
	const provider = new WsProvider(options.endpoint);
	const api = await ApiPromise.create({ provider });
	const latest = await api.derive.chain.bestNumber();
	const latest_hash = await api.rpc.chain.getBlockHash(latest);
	const apiAt = await api.at(latest_hash);

	console.log(
		`****************** Connected to node: ${(await api.rpc.system.chain()).toHuman()} [ss58: ${
			api.registry.chainSS58
		}] ******************`
	);

	console.log(`starting`);
	const DECIMALS = 10_000_000_000;
	const bonded = await apiAt.query.staking.bonded.entries();
	let count = 0;
	console.log(`bonded length = ${bonded.length}`);
	for (let i = 0; i < bonded.length; i++) {
		const [stash, ctrl] = bonded[i];
		// console.log(`[${i}] => stash: ${stash.toHuman()} | ctrl ${ctrl.toHuman()}`);
		const acc = await apiAt.query.system.account(stash.toHuman()?.toString() ?? '');
		const ledger = await apiAt.query.staking.ledger(ctrl.toString());

		const free_bal = acc.data.free.toBigInt();
		let staked = BigInt(0);
		if (ledger.isSome) {
			staked = ledger.unwrap().active.toBigInt();
		}

		if (i % 500 == 0) {
			console.log(`${i}/${bonded.length} done...`);
		}

		if (staked > free_bal) {
			count++;
			console.log(`[${count}] => stash: ${stash.toHuman()} | ctrl ${ctrl.toHuman()}`);
			console.log(`free ${free_bal} => staked ${staked}`);
		}
	}
	console.log(`finished`);
	process.exit(0);
}

// check when consumer reference incremented.

main().catch(console.error);
