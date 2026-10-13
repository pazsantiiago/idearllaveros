import { getStore } from "@netlify/blobs";

export const config = { schedule: "@hourly" };

export default async () => {
  const store = getStore("idear-whatsapp-designs");
  const { blobs } = await store.list();
  const now = Date.now();
  let deleted = 0;

  for (const { key } of blobs) {
    const metadata = await store.getMetadata(key);
    const expiresAt = metadata?.metadata?.expiresAt;
    if (!Number.isFinite(expiresAt) || expiresAt <= now) {
      await store.delete(key);
      deleted++;
    }
  }

  return new Response(`Se eliminaron ${deleted} imágenes vencidas.`);
};
