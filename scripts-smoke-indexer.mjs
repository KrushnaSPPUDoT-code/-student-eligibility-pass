import { ContractState } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
async function main() {
  const url = 'https://indexer.preview.midnight.network/api/v4/graphql';
  const address = 'e664ea4b1efdcdf5f597d71043bf0958241da12d151d1c589655f121c149a535';
  const body = JSON.stringify({
    query: `query($address: HexEncoded!) { contractAction(address: $address) { state } }`,
    variables: { address },
  });
  const res: any = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  const json = await res.json();
  const stateHex: string | null = json?.data?.contractAction?.state ?? null;
  console.log('state present:', !!stateHex, 'len:', stateHex?.length);
  if (!stateHex) { console.log(JSON.stringify(json.errors ?? json)); return; }
  const bytes = new Uint8Array(stateHex.match(/.{2}/g)!.map((b: string) => parseInt(b, 16)));
  const cs = ContractState.deserialize(bytes);
  console.log('decoded data keys:', Object.keys(cs.data));
  console.log('raw data:', JSON.stringify(cs.data).slice(0, 200));
}
main().catch((e) => console.error('ERR', e));
