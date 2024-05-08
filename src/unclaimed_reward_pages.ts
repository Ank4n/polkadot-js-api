// needed as of 7.x series, see CHANGELOG of the api repo.
import '@polkadot/api-augment';
import '@polkadot/types-augment';

import { ApiPromise, WsProvider } from '@polkadot/api';
import { ApiDecoration } from '@polkadot/api/types';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const optionsPromise = yargs(hideBin(process.argv))
	.option('endpoint', {
		alias: 'e',
		type: 'string',
		default: 'wss://polkadot-rpc.dwellir.com',
		description: 'the wss endpoint. It must allow unsafe RPCs.',
		required: true
	})
	.option('era', {
		alias: 'r',
		type: 'number',
		default: -1,
		description: 'the era to check',
		required: true
	}).argv;

async function main() {
	const options = await optionsPromise;
	const provider = new WsProvider(options.endpoint);
	const api = await ApiPromise.create({ provider });
	const latest = await api.derive.chain.bestNumber();
	const latest_hash = await api.rpc.chain.getBlockHash(latest);
	const apiAt = await api.at(latest_hash);

	const current_era = (await api.query.staking.currentEra()).unwrap().toNumber();
	console.log(`Current era: ${current_era}`);
	let era = options.era;
	if (era == -1) {
		console.log(`No era specified. Using current era: ${current_era}`);
		era = current_era;
	}

	console.log(`Looking at era: ${era}`);
	console.log(`** Looking at legacy exposures **`);
	await legacyExposures(apiAt, era);
	console.log(`** Looking at paged exposures **`);
	await pagedExposures(apiAt, era);

	process.exit(0);
}

async function legacyExposures(api: ApiDecoration<'promise'>, era: number) {
	const exposure_keys = await api.query.staking.erasStakers.keys(era);
	exposure_keys.map(
		async ({ args: [era, stash] }) => await isRewardsClaimed(api, stash.toString(), era.toNumber())
	);
}

async function pagedExposures(api: ApiDecoration<'promise'>, era: number) {
	const exposure_keys = await api.query.staking.erasStakersOverview.keys(era);
	for (const {
		args: [era, stash]
	} of exposure_keys) {
		await isRewardsClaimed(api, stash.toString(), era.toNumber());
	}
}

async function isRewardsClaimed(api: ApiDecoration<'promise'>, stash: string, era: number) {
	const controller = (await api.query.staking.bonded(stash)).unwrap();
	// console.log(`controller: ${controller}`);

	const legacyClaimedRewards =
		(await api.query.staking.ledger(controller))
			.unwrap()
			.legacyClaimedRewards.filter((e) => e.toNumber() == era).length == 1;

	// console.log(`legacyClaimedRewards: ${legacyClaimedRewards}`);

	if (legacyClaimedRewards) {
		console.log(`page count: 1, rewards claimed!!`);
		return;
	}

	const pagedExposures = await api.query.staking.erasStakersOverview(era, stash);
	// console.log(`pagedExposures: ${pagedExposures}`);
	const page_count = Math.max(1, pagedExposures.unwrap().pageCount.toNumber());
	// console.log(`page count: ${page_count}`);
	const claimedRewards = await api.query.staking.claimedRewards(era, stash);
	// console.log(`claimedRewards: ${claimedRewards}`);

	const unclaimed_page_count = page_count - claimedRewards.length;
	if (unclaimed_page_count > 0) {
		console.log(
			`\nEra: ${era}, stash: ${stash}, total page count: ${page_count}, claimed_pages: ${claimedRewards}.`
		);
		console.log(`Unclaimed pages: ${unclaimed_page_count}\n`);
	}
}

main().catch(console.error);
