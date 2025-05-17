// needed as of 7.x series, see CHANGELOG of the api repo.
import '@polkadot/api-augment';
import '@polkadot/types-augment';

import type { u32 } from '@polkadot/types';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { ApiDecoration } from '@polkadot/api/types';
import { Balance } from '@polkadot/types/interfaces/runtime';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

async function main() {
	// const westend_endpoint = 'wss://westend-rpc.dwellir.com';
	const westend_endpoint = 'wss://westend-rpc-tn.dwellir.com';
	const westend_provider = new WsProvider(westend_endpoint);
	const westend_api = await ApiPromise.create({ provider: westend_provider });
	const westend_block = 26041702;
	const westend_block_hash = await westend_api.rpc.chain.getBlockHash(westend_block);
	const westend_apiAt = await westend_api.at(westend_block_hash);

	const wah_endpoint = 'wss://asset-hub-westend-rpc.dwellir.com';
	const wah_provider = new WsProvider(wah_endpoint);
	const wah_api = await ApiPromise.create({ provider: wah_provider });
	const wah_block = 11736597; // after second migration ended
	// const wah_block = 11736080; // before second migration started
	const wah_hash = await wah_api.rpc.chain.getBlockHash(wah_block);
	const wah_apiAt = await wah_api.at(wah_hash);

	console.log(`*****Reading AH state at block: ${wah_block}******`);

	const pallets = [
		'staking',
		'nominationPools',
		'fastUnstake',
		'treasury',
		'multisig',
		'proxy',
		'preimage',
		'vesting',
		'indices',
		'referenda',
		'scheduler',
		'convictionVoting',
		// 'bounties',
		'assetRate'
	];

	/*
	console.log(`\n## Westend\n`);
	for (const pallet of pallets) {
		console.log(`\n### ${pallet}\n`);
		const westend_palletFn = (westend_apiAt.query as any)[pallet];

		for (const [name, _item] of Object.entries(westend_palletFn)) {
			const storageFn = (westend_palletFn as any)[name];

			if (typeof storageFn === 'function') {
				try {
					if ('keys' in storageFn && typeof storageFn.keys === 'function') {
						const keys = await storageFn.keys();
						console.log(`${name}: ${keys.length} items`);
					} else {
						const value = await storageFn();
						console.log(`${name}:`, value.toHuman());
					}
				} catch (err) {
					console.warn(`Failed to query ${name}:`, err);
				}
			}
		}
	}
*/
	console.log(`## Asset Hub`);

	for (const pallet of pallets) {
		console.log(`### ${pallet}`);
		const wah_palletFn = (wah_apiAt.query as any)[pallet];

		for (const [name, _item] of Object.entries(wah_palletFn)) {
			const storageFn = (wah_palletFn as any)[name];

			if (typeof storageFn === 'function') {
				try {
					if ('keys' in storageFn && typeof storageFn.keys === 'function') {
						const keys = await storageFn.keys();
						console.log(`${name}: ${keys.length} items`);
					} else {
						const value = await storageFn();
						console.log(`StorageValue ${name}:`, value.toHuman());
					}
				} catch (err) {
					console.warn(`Failed to query ${name}:`, err);
				}
			}
		}
	}

	process.exit(0);
}

main().catch(console.error);
