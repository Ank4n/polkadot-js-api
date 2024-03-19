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
	const latest = await api.derive.chain.bestNumber();
	const latest_hash = await api.rpc.chain.getBlockHash(latest);
	const apiAt = await api.at(latest_hash);

	console.log(
		`****************** Connected to node: ${(await api.rpc.system.chain()).toHuman()} [ss58: ${
			api.registry.chainSS58
		}] ******************`
	);

	// const controllers = await duplicate_controllers(apiAt);
	const controllers = await double_bonded_accounts(apiAt);
	const all_validators = await get_all_validators(apiAt);
	// iterate on set
	console.log(`\nInvestigating ${controllers.size} accounts that are both stash and controller.\n`);
	for (const controller of controllers) {
		console.log(
			'\x1b[31m%s\x1b[0m',
			`\n\n 👉  Looking at account: ${controller} which is a validator: ${all_validators.includes(
				controller
			)}`
		);
		await when_stash(api, controller);
		await when_controller(api, controller);
	}

	process.exit(0);
}

/// return accounts that are both controllers and stash.
async function double_bonded_accounts(apiAt: ApiDecoration<'promise'>): Promise<Set<string>> {
	const reverse_bonded = new Map(); // controller -> stash
	const all_controllers = new Set();
	const controller_became_stash = new Set<string>();

	(await apiAt.query.staking.bonded.entries()).map(([stash, controller]) => {
		const unwrapped_ctrl = controller.toHuman();
		if (reverse_bonded.has(unwrapped_ctrl)) {
			if (stash.toHuman() == unwrapped_ctrl) {
				// update reverse bonded.
				reverse_bonded.set(unwrapped_ctrl, stash.toHuman());
			}
			// do nothing otherwise
		} else {
			reverse_bonded.set(unwrapped_ctrl, stash.toHuman());
			if (unwrapped_ctrl != undefined) {
				all_controllers.add(unwrapped_ctrl.toString());
			}
		}
	});

	// iterate through reverse bonded.
	for (const [controller, stash] of reverse_bonded) {
		if (controller == stash) {
			// all fine with these ledgers.
			continue;
		}
		if (all_controllers.has(stash.toString())) {
			// console.log(`Controller ${controller} became stash ${stash}`);
			// This stash is also controller for a ledger other than self. Should not happen.
			controller_became_stash.add(stash.toString());
		}
	}

	return controller_became_stash;
}

async function get_all_validators(apiAt: ApiDecoration<'promise'>) {
	return (await apiAt.query.staking.validators.keys()).map((key) => key.toHuman()?.toString());
}

// check when ledger associated with this controller got created.
async function when_stash(api: ApiPromise, account: string) {
	const latest = await api.derive.chain.bestNumber();
	const latest_hash = await api.rpc.chain.getBlockHash(latest);
	const apiAt = await api.at(latest_hash);

	const acct = apiAt.registry.createType('AccountId', account);
	const latest_val = await apiAt.query.staking.bonded(acct);

	if (latest_val.isNone) {
		console.log(`❌ ❌ ❌: account ${account} not a stash.`);
		return;
	}

	let start = 0;
	let end = latest.toNumber();

	while (start <= end) {
		const mid = Math.floor((start + end) / 2);

		const blockHash = await api.rpc.chain.getBlockHash(mid);
		const apiAt = await api.at(blockHash);
		const bonded = await apiAt.query.staking.bonded(acct);

		if (bonded.isSome) {
			end = mid - 1;
		} else {
			start = mid + 1;
		}
	}

	console.log('\x1b[36m%s\x1b[0m', ` ⚠️  Became stash at block: ${start}`);
}

async function when_controller(api: ApiPromise, account: string) {
	const latest = await api.derive.chain.bestNumber();
	const latest_hash = await api.rpc.chain.getBlockHash(latest);
	const apiAt = await api.at(latest_hash);

	const acct = apiAt.registry.createType('AccountId', account);
	const latest_val = await apiAt.query.staking.ledger(acct);

	if (latest_val.isNone) {
		console.log(`❌ ❌ ❌: account ${account} not a stash.`);
		return;
	}

	let start = 0;
	let end = latest.toNumber();

	while (start <= end) {
		const mid = Math.floor((start + end) / 2);

		const blockHash = await api.rpc.chain.getBlockHash(mid);
		const apiAt = await api.at(blockHash);
		const val = await apiAt.query.staking.ledger(acct);

		if (val.isSome) {
			end = mid - 1;
		} else {
			start = mid + 1;
		}
	}

	console.log('\x1b[36m%s\x1b[0m', ` ⚠️  Became controller at block: ${start}`);
}

main().catch(console.error);
