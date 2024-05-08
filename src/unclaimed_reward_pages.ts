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
	const legacy_unclaimed = await legacyExposures(apiAt, era);
	console.log(
		`Found ${legacy_unclaimed.length} unclaimed validator rewards from legacy exposures.`
	);
	console.log(legacy_unclaimed);

	const paged_unclaimed = await pagedExposures(apiAt, era);
	console.log(`Found ${paged_unclaimed.length} unclaimed validator rewards from paged exposures.`);
	console.log(paged_unclaimed);

	process.exit(0);
}

interface rewardsClaimed {
	stash: string;
	page_count: number;
	claimed_pages: number[];
}

async function legacyExposures(api: ApiDecoration<'promise'>, era: number) {
	const unclaimed_stashes: rewardsClaimed[] = [];
	const exposure_keys = await api.query.staking.erasStakers.keys(era);
	for (const {
		args: [era, stash]
	} of exposure_keys) {
		const result = await isRewardsClaimed(api, stash.toString(), era.toNumber());
		if (result) {
			unclaimed_stashes.push(result);
		}
	}
	return unclaimed_stashes;
}

async function pagedExposures(api: ApiDecoration<'promise'>, era: number) {
	const unclaimed_stashes: rewardsClaimed[] = [];
	const exposure_keys = await api.query.staking.erasStakersOverview.keys(era);
	for (const {
		args: [era, stash]
	} of exposure_keys) {
		const result = await isRewardsClaimed(api, stash.toString(), era.toNumber());
		if (result) {
			unclaimed_stashes.push(result);
		}
	}
	return unclaimed_stashes;
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
		// console.log(`page count: 1, rewards claimed!!`);
		return { stash: stash, page_count: 1, claimed_pages: [0] };
	}

	const pagedExposures = await api.query.staking.erasStakersOverview(era, stash);
	// console.log(`pagedExposures: ${pagedExposures}`);
	const page_count = Math.max(1, pagedExposures.unwrap().pageCount.toNumber());
	// console.log(`page count: ${page_count}`);
	const claimedRewards = await api.query.staking.claimedRewards(era, stash);
	// console.log(`claimedRewards: ${claimedRewards}`);

	const unclaimed_page_count = page_count - claimedRewards.length;
	if (unclaimed_page_count > 0) {
		// console.log(
		// 	`\nEra: ${era}, stash: ${stash}, total page count: ${page_count}, claimed_pages: ${claimedRewards}.`
		// );
		// console.log(`Unclaimed pages: ${unclaimed_page_count}\n`);
		return {
			stash: stash,
			page_count: page_count,
			claimed_pages: claimedRewards.map((p) => p.toNumber())
		};
	}
}

main().catch(console.error);
