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

	const pool_id = api.createType('u32', 168);
	const points = api.createType('Balance', 1000000000000);

	const start = 69490060;
	const end = 69490065;
	let mid = end;
	console.log(`End: ${end}`);

	while (start <= mid) {
		mid = mid - 1;
		console.log(`Mid: ${mid}`);
		const hash = await api.rpc.chain.getBlockHash(mid);
		const midApi = await api.at(hash);
		try {
			const result = await midApi.call.nominationPoolsApi.balanceToPoints(pool_id, points);

			if (result.toNumber() == points.toNumber()) {
				console.log(
					'\x1b[39m%s\x1b[0m',
					` ⚠️ points ${points}, balance ${result} at block: ${mid}`
				);
				break;
			}

			console.log('\x1b[36m%s\x1b[0m', ` ⚠️ points ${points}, balance ${result} at block: ${mid}`);
		} catch (e) {
			// start = mid + 1;
			// continue;
		}
	}

	console.log('\x1b[36m%s\x1b[0m', ` ⚠️ END!! start: ${start}, end ${end}`);
	process.exit(0);
}

// check when consumer reference incremented.
async function when_consumer_eq(api: ApiPromise, account: string, consumer: number) {
	const latest = await api.derive.chain.bestNumber();
	const latest_hash = await api.rpc.chain.getBlockHash(latest);
	const apiAt = await api.at(latest_hash);

	const acct = apiAt.registry.createType('AccountId', account);
	const latest_val = await apiAt.query.system.account(acct);
	console.log(`current_val of account: ${account} is ${latest_val}`);

	let start = 0;
	let end = latest.toNumber();

	while (start <= end) {
		const mid = Math.floor((start + end) / 2);

		const blockHash = await api.rpc.chain.getBlockHash(mid);
		const apiAt = await api.at(blockHash);
		const bonded = await apiAt.query.system.account(acct);

		if (bonded.consumers.toNumber() == consumer) {
			end = mid - 1;
		} else {
			start = mid + 1;
		}
	}

	console.log(
		'\x1b[36m%s\x1b[0m',
		` ⚠️ account consumer became euqal to ${consumer} at block: ${start}`
	);
}

main().catch(console.error);
