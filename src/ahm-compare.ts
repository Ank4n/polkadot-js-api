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
	// const one_endpoint = 'wss://westend-rpc.dwellir.com';
	// const one_endpoint = 'wss://westend-rpc-tn.dwellir.com';
	// const one_endpoint = 'wss://asset-hub-westend-rpc.dwellir.com';
	const one_endpoint = 'wss://westmint-rpc-tn.dwellir.com';
	const one_provider = new WsProvider(one_endpoint);
	const one_api = await ApiPromise.create({ provider: one_provider });
	// const one_block = 26041702; // westend before first migration
	const one_block = 11736080; // wah before second migration started
	const one_block_hash = await one_api.rpc.chain.getBlockHash(one_block);
	const one_apiAt = await one_api.at(one_block_hash);

	// const two_endpoint = 'wss://asset-hub-westend-rpc.dwellir.com';
	const two_endpoint = 'wss://westmint-rpc-tn.dwellir.com';
	const two_provider = new WsProvider(two_endpoint);
	const two_api = await ApiPromise.create({ provider: two_provider });
	const two_block = 11736597; // wah after second migration ended
	// const two_block = 11736080; // wah before second migration started
	const two_hash = await two_api.rpc.chain.getBlockHash(two_block);
	const two_apiAt = await two_api.at(two_hash);

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

	const map = new Map<string, string>();

	console.log(
		`Going through pallets in Node 01: ${(
			await one_api.rpc.system.chain()
		).toHuman()} at block ${one_block}`
	);

	for (const pallet of pallets) {
		console.log(`Pallet: ${pallet}`);
		const one_palletFn = (one_apiAt.query as any)[pallet];

		for (const [name, _item] of Object.entries(one_palletFn)) {
			const storageFn = (one_palletFn as any)[name];

			if (typeof storageFn === 'function') {
				try {
					if ('keys' in storageFn && typeof storageFn.keys === 'function') {
						const keys = await storageFn.keys();
						map.set(pallet + '::' + name + ' map keys', keys.length);
						// console.log(`${name}: ${keys.length} items`);
					} else {
						const value = await storageFn();
						map.set(pallet + '::' + name + ' value', value.toHuman());
					}
				} catch (err) {
					console.warn(`Failed to query ${name}:`, err);
				}
			}
		}
	}

	console.log(
		`Going through pallets in Node 02: ${(
			await two_api.rpc.system.chain()
		).toHuman()} at block ${two_block}`
	);

	console.log('Generating Diff');

	for (const pallet of pallets) {
		console.log(`\n====== Pallet: ${pallet} =======\n`);
		const two_palletFn = (two_apiAt.query as any)[pallet];

		for (const [name, _item] of Object.entries(two_palletFn)) {
			const storageFn = (two_palletFn as any)[name];

			if (typeof storageFn === 'function') {
				try {
					if ('keys' in storageFn && typeof storageFn.keys === 'function') {
						const keys = await storageFn.keys();
						// compare against node 01 storage.
						const map_key = pallet + '::' + name + ' map keys';
						const first = map.get(map_key);
						const second = keys.length;
						if (first !== second) {
							console.log(`⚠️ ⚠️ ${map_key}: value changed from <${first}> to <${second}>`);
						}
						// console.log(`${name}: ${keys.length} items`);
					} else {
						const value = await storageFn();
						const map_key = pallet + '::' + name + ' value';
						const first = map.get(map_key);
						const second = value.toHuman();
						if (first !== second) {
							console.log(`⚠️ ⚠️ ${map_key}: value changed from <${first}> to <${second}>`);
						}
						// console.log(`StorageValue ${name}:`, value.toHuman());
					}
				} catch (err) {
					console.warn(`Failed to query ${name}:`, err);
				}
			}
		}
	}

	console.log('----------------------------------');
	process.exit(0);
}

main().catch(console.error);
