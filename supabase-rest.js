export async function fetchAllSupabaseRows(url, headers, options = {}) {
  const pageSize = Number(options.pageSize) || 1000;
  const maxRows = Number(options.maxRows) || 100000;
  const optional = options.optional === true;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("Fetch is unavailable");
  if (!Number.isInteger(pageSize) || pageSize < 1 || !Number.isInteger(maxRows) || maxRows < pageSize) {
    throw new TypeError("Invalid pagination limits");
  }

  const rows = [];
  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const end = Math.min(offset + pageSize - 1, maxRows - 1);
    const response = await fetchImpl(url, {
      headers: { ...headers, Range: `${offset}-${end}`, "Range-Unit": "items" }
    });
    if (!response.ok) {
      if (optional && (response.status === 404 || response.status === 406)) return [];
      throw new Error(`Supabase query failed (${response.status})`);
    }
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new TypeError("Supabase pagination expected an array response");
    if (batch.length > pageSize) throw new Error("Supabase ignored the requested page range");
    rows.push(...batch);
    if (batch.length < pageSize) return rows;
  }

  throw new Error(`Supabase result reached the safety cap of ${maxRows} rows; refusing to return possibly incomplete analytics`);
}
