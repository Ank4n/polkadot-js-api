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
	console.log(`Current era: ${current_era}\n`);

	console.log(`\n## Stash with span greater than 3\n`);
	const prior_freq = new Map<number, number>();
	const slashing_spans = await api.query.staking.slashingSpans.entries();
	for (const x of slashing_spans) {
		if (x[1].isEmpty) continue;
		const span_prior_length = x[1].unwrap().prior.length;
		if (span_prior_length >= 3) {
			console.log(`-> ${x[0].toHuman()} \n \`\`\`json \n ${x[1].toString()} \n \`\`\` \n`);
		}
		prior_freq.set(span_prior_length, (prior_freq.get(span_prior_length) || 0) + 1);
	}

	console.log(`\n## Prior vec size distribution of SlashingSpans\n`);
	console.log(`| page count | frequency |`);
	console.log(`|------------|-----------|`);

	for (const [page_count, frequency] of prior_freq) {
		console.log(`| ${page_count} | ${frequency} |`);
	}

	process.exit(0);
}

main().catch(console.error);
