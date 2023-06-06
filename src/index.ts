// needed as of 7.x series, see CHANGELOG of the api repo.
import '@polkadot/api-augment';
import '@polkadot/types-augment';

import { ApiPromise, WsProvider } from '@polkadot/api';
import { Balance } from '@polkadot/types/interfaces/runtime';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const optionsPromise = yargs(hideBin(process.argv)).option('endpoint', {
	alias: 'e',
	type: 'string',
	default: 'wss://statemine-rpc.polkadot.io',
	description: 'the wss endpoint. It must allow unsafe RPCs.',
	required: true
}).argv;

async function main() {
	const options = await optionsPromise;
	const provider = new WsProvider(options.endpoint);
	const api = await ApiPromise.create({ provider });

	console.log(
		`****************** Connected to node: ${options.endpoint} ${(
			await api.rpc.system.chain()
		).toHuman()} [ss58: ${api.registry.chainSS58}] ******************`
	);

	await getRecentBlocks(api, 256);
	// await which_pallets(api);
	// await read_const(api);
	// await subscribe_finalized_blocks(api);

	process.exit(0);
}

async function getRecentBlocks(api: ApiPromise, count: number) {
	const lastBlockNumber = await api.derive.chain.bestNumber();
	const maxProofSize = 5 * 1024 * 1024; // 5 MB
	const maxRefTime = 500_000_000_000; // 0.5 seconds

	// normal percentage ref time, if we equal same ref time, what would be max proof size.
	console.log(`| Block | fullness by ref time | fullness by proof size |`);
	console.log(`| ---- | ---- | ---- |`);
	for (let i = lastBlockNumber.toNumber(); i > lastBlockNumber.toNumber() - count; i--) {
		const blockHash = await api.rpc.chain.getBlockHash(i);
		const apiAt = await api.at(blockHash);
		const blockWeight = await apiAt.query.system.blockWeight();

		const blockFullnessRefTime = (blockWeight.normal.refTime.toNumber() * 100) / maxRefTime;
		const blockFullnessProofSize = (blockWeight.normal.proofSize.toNumber() * 100) / maxProofSize;

        if (blockWeight.normal.refTime.toNumber() || blockWeight.normal.proofSize.toNumber() > 0) {
		    console.log(
			    `${i} | ${blockFullnessRefTime} % | ${blockFullnessProofSize} %`
		    );
		}
	}

}

async function subscribe_finalized_blocks(api: ApiPromise) {
	const unsub = await api.rpc.chain.subscribeFinalizedHeads((header) => {
		console.log(`finalized block #${header.number}`);
	});
}
async function which_pallets(api: ApiPromise) {
	console.log(`Found following pallets with their version`);
	for (const key in api.query) {
		if (api.query[key] && api.query[key].palletVersion) {
			console.log(key, (await api.query[key].palletVersion()).toHuman());
		}
	}
}

async function read_const(api: ApiPromise) {
	const ED: Balance = api.consts.balances.existentialDeposit;
	console.log(`Existential deposit: ${ED.toHuman()}`);
}

main().catch(console.error);
