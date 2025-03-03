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

	const current_era = (await api.query.staking.currentEra()).unwrap().toNumber();
	console.log(`Querying from era: ${current_era - 28} to ${current_era}\n`);

	for (let era = current_era - 28; era < current_era; era++) {
		console.log(`\n## Era ${era}`);
		const claimed_rewards = await api.query.staking.claimedRewards.entries(era);
		// map of count -> frequency
		const claimed_rewards_map = new Map<number, number>();
		for (const x of claimed_rewards.values()) {
			const page_count = x[1].length;
			claimed_rewards_map.set(page_count, (claimed_rewards_map.get(page_count) || 0) + 1);
		}

		console.log(`\n### Page distribution based on Claimed rewards\n`);
		console.log(`| page count | frequency |`);
		console.log(`|------------|-----------|`);

		for (const [page_count, frequency] of claimed_rewards_map) {
			console.log(`| ${page_count} | ${frequency} |`);
		}

		const exposures = await api.query.staking.erasStakersOverview.entries(era);
		const exposure_page_frequency = new Map<number, number>();
		for (const x of exposures) {
			if (x[1].isNone) continue;
			const meta = x[1].unwrap();
			exposure_page_frequency.set(
				meta.pageCount.toNumber(),
				(exposure_page_frequency.get(meta.pageCount.toNumber()) || 0) + 1
			);
		}

		console.log(`\n### Page distribution based on Exposure Data\n`);
		console.log(`| page count | frequency |`);
		console.log(`|------------|-----------|`);

		for (const [page_count, frequency] of exposure_page_frequency) {
			console.log(`| ${page_count} | ${frequency} |`);
		}
	}

	process.exit(0);
}

main().catch(console.error);
