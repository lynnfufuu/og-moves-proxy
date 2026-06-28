/**
 * OG-MOVES proxy worker.
 * Holds OPENSEA_KEY, ETHERSCAN_KEY, ALCHEMY_KEY as secrets (never shipped to the browser).
 * The mini app calls these endpoints instead of calling OpenSea/Etherscan/Alchemy directly.
 *
 * Deploy: wrangler deploy   (see DEPLOY.md for full steps)
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
      // ---- OpenSea: NFTs held by a wallet ----
      if (path === "/opensea/nfts") {
        const address = url.searchParams.get("address");
        if (!address) return json({ error: "address required" }, 400);
        const r = await fetch(
          `https://api.opensea.io/api/v2/chain/ethereum/account/${address}/nfts?limit=24`,
          { headers: { accept: "application/json", "x-api-key": env.OPENSEA_KEY } }
        );
        return json(await r.json(), r.status);
      }

      // ---- OpenSea: single NFT detail (traits + rarity) ----
      if (path === "/opensea/nft") {
        const contract = url.searchParams.get("contract");
        const id = url.searchParams.get("id");
        if (!contract || !id) return json({ error: "contract and id required" }, 400);
        const r = await fetch(
          `https://api.opensea.io/api/v2/chain/ethereum/contract/${contract}/nfts/${id}`,
          { headers: { accept: "application/json", "x-api-key": env.OPENSEA_KEY } }
        );
        return json(await r.json(), r.status);
      }

      // ---- OpenSea: collection floor stats ----
      if (path === "/opensea/floor") {
        const slug = url.searchParams.get("slug");
        if (!slug) return json({ error: "slug required" }, 400);
        const r = await fetch(`https://api.opensea.io/api/v2/collections/${slug}/stats`, {
          headers: { accept: "application/json", "x-api-key": env.OPENSEA_KEY }
        });
        return json(await r.json(), r.status);
      }

      // ---- OpenSea: sale events for a wallet ----
      if (path === "/opensea/events") {
        const address = url.searchParams.get("address");
        if (!address) return json({ error: "address required" }, 400);
        const r = await fetch(
          `https://api.opensea.io/api/v2/events/accounts/${address}?event_type=sale&limit=50`,
          { headers: { accept: "application/json", "x-api-key": env.OPENSEA_KEY } }
        );
        return json(await r.json(), r.status);
      }

      // ---- Etherscan: gas oracle ----
      if (path === "/etherscan/gas") {
        const r = await fetch(
          `https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${env.ETHERSCAN_KEY}`
        );
        return json(await r.json(), r.status);
      }

      // ---- Alchemy: JSON-RPC passthrough (asset transfers, tx lookups) ----
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
