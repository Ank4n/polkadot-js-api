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

	const all_validators = await get_all_validators(apiAt);
	// iterate on set
	for (const stash of all_validators) {
		if (stash !== undefined) {
			await unclaimed_pages(apiAt, stash, 1431);
		}
	}

	process.exit(0);
}

/// return accounts that are both controllers and stash.
async function unclaimed_pages(
	api: ApiDecoration<'promise'>,
	stash: string,
	era: number
): Promise<Set<number>> {
	const controller = (await api.query.staking.bonded(stash)).unwrap();

	// calculate pages
	let pageCount = 0;

	// check if non paged exposure, then page is always 1
	if ((await api.query.staking.erasStakers(era, stash)).total.toNumber() > 0) {
		pageCount = 1;
	} else {
		const overview = await api.query.staking.erasStakersOverview(era, stash);
		if (overview !== null && overview.isSome) {
			// if paged exposure, we get count from `ErasStakersOverview`.
			// there is a special case when a validator has no exposure. They still have to claim rewards for their own
			// stake so they still have 1 page of rewards to claim.
			pageCount = Math.max(overview.unwrap().pageCount.toNumber(), 1);
		} else {
			console.log('no exposure found');
			return new Set();
		}
	}

	// get legacy claimed rewards.
	const legacyClaimedRewards =
		(await api.query.staking.ledger(controller))
			.unwrap()
			.legacyClaimedRewards.filter((e) => e.toNumber() == era).length == 1;

	if (legacyClaimedRewards) {
		console.log(`rewards claimed for era: ${era} and stash: ${stash}`);
		return new Set();
	}

	// get paged claimed rewards.
	const pagedClaimedRewards = await api.query.staking.claimedRewards(era, stash);
	const unclaimed_pages = new Set<number>();

	for (let i = 0; i < pageCount; i++) {
		if (!pagedClaimedRewards.find((pages) => pages.eq(i))) {
			unclaimed_pages.add(i);
		}
	}

	return unclaimed_pages;
}

async function get_all_validators(apiAt: ApiDecoration<'promise'>) {
	return (await apiAt.query.staking.validators.keys()).map((key) => key.toHuman()?.toString());
}

main().catch(console.error);
