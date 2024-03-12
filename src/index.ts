// needed as of 7.x series, see CHANGELOG of the api repo.
import '@polkadot/api-augment';
import '@polkadot/types-augment';

import type { u32 } from '@polkadot/types';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { ApiDecoration } from '@polkadot/api/types';
import { Balance } from '@polkadot/types/interfaces/runtime';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
// import { createType } from '@polkadot/types';

const optionsPromise = yargs(hideBin(process.argv)).option('endpoint', {
	alias: 'e',
	type: 'string',
	default: 'wss://polkadot-rpc.dwellir.com',
	description: 'the wss endpoint. It must allow unsafe RPCs.',
	required: true
}).argv;

// const before_tx_block = '0x10872fab80953d126b9f01c27f37a92bd4df9f16d24d2a4e0a25f37e035ea6c0';
// const after_tx_block = '0x75c350393a01c27f3545c975757ff455397c46cc6c917ea3d7b728af2228c837';

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

	// 	await getRecentBlocks(api, 10);
	// await which_pallets(api);
	// await read_const(api);
	// await subscribe_finalized_blocks(api);
	// const pendingRewards = await pending_rewards(apiAt, 1);
	// console.log(`Pending Rewards: ${pendingRewards}`);
	const controllers = await duplicate_controllers(apiAt);
	// iterate on set
	for (const controller of controllers) {
		await when_controller_deprecated(api, controller);
	}

	process.exit(0);
}

async function getRecentBlocks(api: ApiPromise, count: number) {
	const lastBlockNumber = await api.derive.chain.bestNumber();

	for (let i = lastBlockNumber.toNumber(); i > lastBlockNumber.toNumber() - count; i--) {
		const blockHash = await api.rpc.chain.getBlockHash(i);
		const apiAt = await api.at(blockHash);
		const blockWeight = await apiAt.query.system.blockWeight();

		console.log(`Block ${lastBlockNumber.toNumber() - i}: ${blockHash}`);
		console.log(`Block weight ${blockWeight.normal}`);
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

function existential_deposit(apiAt: ApiDecoration<'promise'>) {
	return apiAt.consts.balances.existentialDeposit;
}

async function current_reward_counter(apiAt: ApiDecoration<'promise'>, poolID: number) {
	const balance = await rewardBalance(apiAt);
	const rewardPool = (await apiAt.query.nominationPools.rewardPools(poolID)).unwrap();
	const bondedPool = (await apiAt.query.nominationPools.bondedPools(poolID)).unwrap();
	const min_balance = existential_deposit(apiAt);
	const payout_balance = balance
		.sub(min_balance)
		.add(rewardPool.totalRewardsClaimed)
		.sub(rewardPool.lastRecordedTotalPayouts);
	console.log(`Free balance: ${balance}, Current Balance: ${balance.sub(min_balance)}`);
	return payout_balance.div(bondedPool.points).add(rewardPool.lastRecordedRewardCounter);
}

async function pending_rewards(apiAt: ApiDecoration<'promise'>, poolID: number) {
	const members = (await apiAt.query.nominationPools.poolMembers.entries()).filter(
		([account, member]) => member.unwrap().poolId.toNumber() == poolID
	);
	const pendingRewards = apiAt.registry.createType('u32', 0);
	const crc = await current_reward_counter(apiAt, poolID);
	console.log(`Current Reward Counter: ${crc}`);
	members.forEach(([account, member]) => {
		const delegator = member.unwrap();
		const memberPendingReward = crc.sub(delegator.lastRecordedRewardCounter).mul(delegator.points);
		//         console.log(`Processing account ${account.toHuman()}`);
		//         console.log(`reward counter: {$delegator.lastRecordedRewardCounter} | points: ${delegator.points} | PendingReward: => ${memberPendingReward}`);
		pendingRewards.iadd(memberPendingReward);
		//         console.log(`Total Pending Reward: ${pendingRewards}`)
	});

	return pendingRewards;
}

async function rewardBalance(apiAt: ApiDecoration<'promise'>) {
	const rewardAddr = 'F3opxRbN5ZavB4LTn2XJkJjzssVSUggzq75YZueYesPwk5J';
	const rewardAcct = apiAt.registry.createType('AccountId', rewardAddr);
	return (await apiAt.query.system.account(rewardAcct)).data.free;
}

async function duplicate_controllers(apiAt: ApiDecoration<'promise'>) {
	const reverse_bonded = new Map(); // controller -> stash
	const duplicate_controllers = new Set<string>();

	(await apiAt.query.staking.bonded.entries()).map(([stash, controller]) => {
		if (reverse_bonded.has(controller.toHuman())) {
			console.log(
				'\x1b[36m%s\x1b[0m',
				`🙈 🙉 🙊 Duplicate controller found: ${controller.toHuman()} for stashes ${stash.toHuman()} and ${reverse_bonded.get(
					controller.toHuman()
				)}`
			);
			duplicate_controllers.add(controller.toString());
		} else {
			reverse_bonded.set(controller.toHuman(), stash.toHuman());
		}
	});

	return duplicate_controllers;
}

/// checks when controller and stash became same.
async function when_controller_deprecated(api: ApiPromise, bonded_account: string) {
	const latest = await api.derive.chain.bestNumber();
	const latest_hash = await api.rpc.chain.getBlockHash(latest);
	const apiAt = await api.at(latest_hash);

	const acct = apiAt.registry.createType('AccountId', bonded_account);
	const latest_val = await apiAt.query.staking.bonded(acct);

	if (latest_val.isNone || latest_val.unwrap().toHuman() != acct.toHuman()) {
		console.log(`❌ ❌ ❌: Controller ${bonded_account} not deprecated yet.`);
		return;
	}

	// console.log(`Binary searching change in bonded value for: ${bonded_account}`);
	// console.log(`Current value: ${latest_val.toHuman()}`);

	let start = 0;
	let end = latest.toNumber();

	while (start <= end) {
		const mid = Math.floor((start + end) / 2);
		// console.log(`Searching between ${start} and ${end} with mid: ${mid}`);

		const blockHash = await api.rpc.chain.getBlockHash(mid);
		const apiAt = await api.at(blockHash);
		const bonded = await apiAt.query.staking.bonded(acct);
		// console.log(`bonded exists: ${bonded.isSome} at block: ${mid}`);

		if (bonded.toHuman() == latest_val.toHuman()) {
			end = mid - 1;
		} else {
			start = mid + 1;
		}
	}

	console.log(
		'\x1b[36m%s\x1b[0m',
		`🎭 🆘 ⚠️  🚧 Controller ${bonded_account} became same as stash at block: ${start} with hash: ${await api.rpc.chain.getBlockHash(
			start
		)}`
	);
}

main().catch(console.error);
