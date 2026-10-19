async function bacaRegions() {
  const isi = await fs.readFile(REGION_FILE, "utf8");
  return JSON.parse(isi);
}

async function tanganiRegions(req, res, segmen) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return kirimError(
      res,
      405,
      `Method ${req.method} tidak didukung pada endpoint ini`,
    );
  }
  const regions = await bacaRegions();
  if (segmen.length === 1) {
    return kirimJSON(res, 200, regions);
  }
  const item = regions.find((r) => r.id === Number(segmen[1]));
  if (!item) {
    return kirimError(
      res,
      404,
      `Region dengan id ${segmen[1]} tidak ditemukan`,
    );
  }
  kirimJSON(res, 200, item);
}