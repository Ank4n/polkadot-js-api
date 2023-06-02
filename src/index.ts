// needed as of 7.x series, see CHANGELOG of the api repo.
import '@polkadot/api-augment';
import '@polkadot/types-augment';

import {ApiPromise, WsProvider} from '@polkadot/api';
import {Balance} from '@polkadot/types/interfaces/runtime';
import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';

const optionsPromise = yargs(hideBin(process.argv)).option('endpoint', {
    alias: 'e',
    type: 'string',
    default: 'wss://kusama-rpc.polkadot.io',
    description: 'the wss endpoint. It must allow unsafe RPCs.',
    required: true
}).argv;

async function main() {
    const options = await optionsPromise;
    const provider = new WsProvider(options.endpoint);
    const api = await ApiPromise.create({provider});

    console.log(
        `****************** Connected to node: ${options.endpoint} ${(await api.rpc.system.chain()).toHuman()} [ss58: ${
            api.registry.chainSS58
        }] ******************`
    );

    await getRecentBlocks(api, 200);
    // await which_pallets(api);
    // await read_const(api);
	// await subscribe_finalized_blocks(api);

    process.exit(0);
}

async function getRecentBlocks(api: ApiPromise, count: number) {
    const lastBlockNumber = await api.derive.chain.bestNumber();
    // const maxProofSize = 18_446_744_073_709_551_615; // u64::max_value()
    const maxRefTime = 2_000_000_000_000; // 2 seconds
    let maxIdeal = 0;
    let minIdeal = 18_446_744_073_709_551_615;
    let sumIdeal = 0;
    // normal percentage ref time, if we equal same ref time, what would be max proof size.
    console.log(`Block | ref time | proof size | Block fullness | Ideal max proof`);
    for (let i = lastBlockNumber.toNumber(); i > lastBlockNumber.toNumber() - count; i--) {
        const blockHash = await api.rpc.chain.getBlockHash(i);
        const apiAt = await api.at(blockHash);
        const blockWeight = await apiAt.query.system.blockWeight();

        let blockFullnessRefTime = blockWeight.normal.refTime.toNumber() * 100 / maxRefTime;
        let idealMaxProofSize = blockWeight.normal.proofSize.toNumber() * 100 / blockFullnessRefTime;

        if (idealMaxProofSize > 0) {
            console.log(`${i} | ${blockWeight.normal.refTime} | ${blockWeight.normal.proofSize} | ${blockFullnessRefTime} | ${idealMaxProofSize}`);
            maxIdeal = Math.max(maxIdeal, idealMaxProofSize);
            minIdeal = Math.min(minIdeal, idealMaxProofSize);
            sumIdeal += idealMaxProofSize;
        }
    }

    console.log(`Max ideal: ${maxIdeal} | Min ideal: ${minIdeal} | Avg ideal: ${sumIdeal / count}`);
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
