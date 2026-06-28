/**
 * OG-MOVES proxy worker.
 * Primary NFT data: Alchemy (getNFTsForOwner, getNFTMetadata, getFloorPrice)
 * Gas: Etherscan V2
 * Sales: OpenSea (optional, falls back gracefully)
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS }
  });
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

    const url = new URL(req.url);
    const path = url.pathname;

    try {

      // ---- Alchemy: NFTs held by a wallet ----
      if (path === "/alchemy/nfts") {
        const address = url.searchParams.get("address");
        if (!address) return json({ error: "address required" }, 400);
        const r = await fetch(
          `https://eth-mainnet.g.alchemy.com/nft/v3/${env.ALCHEMY_KEY}/getNFTsForOwner?owner=${address}&withMetadata=true&pageSize=50`,
          { headers: { accept: "application/json" } }
        );
        return json(await r.json(), r.status);
      }

      // ---- Alchemy: single NFT metadata (traits + rarity) ----
      if (path === "/alchemy/nft") {
        const contract = url.searchParams.get("contract");
        const id = url.searchParams.get("id");
        if (!contract || !id) return json({ error: "contract and id required" }, 400);
        const r = await fetch(
          `https://eth-mainnet.g.alchemy.com/nft/v3/${env.ALCHEMY_KEY}/getNFTMetadata?contractAddress=${contract}&tokenId=${id}&refreshCache=false`,
          { headers: { accept: "application/json" } }
        );
        return json(await r.json(), r.status);
      }

      // ---- Alchemy: floor price for a contract ----
      if (path === "/alchemy/floor") {
        const contract = url.searchParams.get("contract");
        if (!contract) return json({ error: "contract required" }, 400);
        const r = await fetch(
          `https://eth-mainnet.g.alchemy.com/nft/v3/${env.ALCHEMY_KEY}/getFloorPrice?contractAddress=${contract}`,
          { headers: { accept: "application/json" } }
        );
        return json(await r.json(), r.status);
      }

      // ---- Alchemy: collection contract metadata ----
      if (path === "/alchemy/collection") {
        const contract = url.searchParams.get("contract");
        if (!contract) return json({ error: "contract required" }, 400);
        const r = await fetch(
          `https://eth-mainnet.g.alchemy.com/nft/v3/${env.ALCHEMY_KEY}/getContractMetadata?contractAddress=${contract}`,
          { headers: { accept: "application/json" } }
        );
        return json(await r.json(), r.status);
      }

      // ---- Etherscan: gas oracle (V2) ----
      if (path === "/etherscan/gas") {
        const r = await fetch(
          `https://api.etherscan.io/v2/api?chainid=1&module=gastracker&action=gasoracle&apikey=${env.ETHERSCAN_KEY}`
        );
        return json(await r.json(), r.status);
      }

      // ---- OpenSea: sale events for a wallet (optional) ----
      if (path === "/opensea/events") {
        const address = url.searchParams.get("address");
        if (!address) return json({ error: "address required" }, 400);
        const r = await fetch(
          `https://api.opensea.io/api/v2/events/accounts/${address}?event_type=sale&limit=50`,
          { headers: { accept: "application/json", "x-api-key": env.OPENSEA_KEY } }
        );
        return json(await r.json(), r.status);
      }

      // ---- Alchemy: JSON-RPC passthrough ----
      if (path === "/alchemy/rpc" && req.method === "POST") {
        const body = await req.json();
        const r = await fetch(`https://eth-mainnet.g.alchemy.com/v2/${env.ALCHEMY_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        return json(await r.json(), r.status);
      }

      return json({ error: "not found" }, 404);

    } catch (err) {
      return json({ error: String(err.message || err) }, 500);
    }
  }
};
