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

async function main() {
	const options = await optionsPromise;
	const provider = new WsProvider(options.endpoint);
	const api = await ApiPromise.create({ provider });

	console.log(
		`****************** Connected to node: ${(await api.rpc.system.chain()).toHuman()} [ss58: ${
			api.registry.chainSS58
		}] ******************`
	);

	await corrupt_ledgers(api);

	process.exit(0);
}

// find bonded accounts where controller not == stash and associated ledger. If
// associated ledger is none or ledger.stash not equal to our stash, then its
// corrupt.
async function corrupt_ledgers(api: ApiPromise) {
	const latest = await api.derive.chain.bestNumber();
	const latest_hash = await api.rpc.chain.getBlockHash(latest);
	const apiAt = await api.at(latest_hash);

	const validators = await get_all_validators(apiAt);
	const all_ledgers = await get_all_ledgers(apiAt);

	for (const [stash, controller] of await apiAt.query.staking.bonded.entries()) {
		// console.log(`Checking: ${controller.toHuman()} | ${stash.toHuman()}`);
		const ledger = all_ledgers.get(controller.toHuman()?.toString());

		if (
			ledger == undefined ||
			ledger.isNone ||
			ledger.unwrap().stash.toHuman() != stash.toHuman()
		) {
			// console.log(
			// 	'\n\n\x1b[36m%s\x1b[0m',
			// 	`🙈 🙉 🙊 Corrupt ledger found for controller: ${controller.toHuman()} | stash: ${stash.toHuman()}`
			// );
			//
			console.log(
				'\x1b[31m%s\x1b[0m',
				`⚙️  ⚙️  ⚙️  Is stash account ${stash} validator: ${validators.includes(
					stash.toHuman()?.toString()
				)}`
			);

			await when_ledger_corruption(
				api,
				stash.toHuman()?.toString() ?? '',
				controller.toHuman()?.toString() ?? ''
			);
		}
	}
}

async function get_all_validators(apiAt: ApiDecoration<'promise'>) {
	return (await apiAt.query.staking.validators.keys()).map((key) => key.toHuman()?.toString());
}

// return map of controller -> ledger
async function get_all_ledgers(apiAt: ApiDecoration<'promise'>) {
	const map = new Map();
	(await apiAt.query.staking.ledger.entries()).map(([key, val]) =>
		map.set(key.toHuman()?.toString(), val)
	);

	return map;
}

/// checks when ledger became corrupt.
async function when_ledger_corruption(api: ApiPromise, stash_str: string, controller_str: string) {
	const latest = await api.derive.chain.bestNumber();
	const latest_hash = await api.rpc.chain.getBlockHash(latest);
	const apiAt = await api.at(latest_hash);

	const controller = apiAt.registry.createType('AccountId', controller_str);

	let start = 0;
	let end = latest.toNumber();

	while (start <= end) {
		const mid = Math.floor((start + end) / 2);
		// console.log(`Searching between ${start} and ${end} with mid: ${mid}`);

		const blockHash = await api.rpc.chain.getBlockHash(mid);
		const apiAt = await api.at(blockHash);
		const ledger = await apiAt.query.staking.ledger(controller);
		// console.log(`bonded exists: ${bonded.isSome} at block: ${mid}`);

		if (
			ledger != undefined &&
			ledger.isSome &&
			ledger.unwrap().stash.toHuman().toString() != stash_str
		) {
			// corruption already has happened, go further in past
			end = mid - 1;
		} else {
			start = mid + 1;
		}
	}

	if (start >= latest.toNumber()) {
		// could not find result
		console.log(
			'\x1b[31m%s\x1b[0m',
			`🙈 🙉 🙊 Could not find when ledger corrupted for controller: ${controller_str} | stash: ${stash_str}`
		);
	} else {
		console.log(
			'\x1b[36m%s\x1b[0m',
			`🎭 🆘 ⚠️  🚧 Ledger overwritten for controller: ${controller_str} | stash: ${stash_str} at block: ${start} with hash: ${await api.rpc.chain.getBlockHash(
				start
			)}`
		);
	}
}

main().catch(console.error);
