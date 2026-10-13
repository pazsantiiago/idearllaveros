import { randomUUID } from "node:crypto";
import { getStore } from "@netlify/blobs";

const STORE_NAME = "idear-whatsapp-designs";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const LIFETIME_MS = 24 * 60 * 60 * 1000;

const json = (data, status = 200) => Response.json(data, {
  status,
  headers: { "Cache-Control": "no-store" }
});

export default async (request) => {
  const store = getStore(STORE_NAME);
  const url = new URL(request.url);

  if (request.method === "POST") {
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin) return json({ error: "Origen no permitido." }, 403);

    let form;
    try {
      form = await request.formData();
    } catch {
      return json({ error: "No se pudo leer la imagen enviada." }, 400);
    }

    const image = form.get("image");
    if (!(image instanceof File) || image.type !== "image/jpeg") {
      return json({ error: "Se esperaba una imagen JPG." }, 415);
    }
    if (image.size < 1 || image.size > MAX_IMAGE_BYTES) {
      return json({ error: "La imagen supera el tamaño permitido." }, 413);
    }

    const id = randomUUID();
    const expiresAt = Date.now() + LIFETIME_MS;
    await store.set(id, image, {
      metadata: { expiresAt, contentType: "image/jpeg" },
      onlyIfNew: true
    });

    return json({
      url: `${url.origin}/.netlify/functions/design-image?id=${id}`,
      expiresAt
    }, 201);
  }

  if (request.method === "GET") {
    const id = url.searchParams.get("id") || "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Imagen no encontrada.", { status: 404 });

    const metadata = await store.getMetadata(id);
    if (!metadata) return new Response("Imagen no encontrada o vencida.", { status: 404 });

    if (!Number.isFinite(metadata.metadata?.expiresAt) || metadata.metadata.expiresAt <= Date.now()) {
      await store.delete(id);
      return new Response("Este enlace de imagen venció.", { status: 410 });
    }

    const image = await store.get(id, { type: "arrayBuffer" });
    if (!image) return new Response("Imagen no encontrada.", { status: 404 });

    return new Response(image, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(image.byteLength),
        "Content-Disposition": 'inline; filename="diseno-idear.jpg"',
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff"
      }
    });
  }

  return new Response("Método no permitido.", {
    status: 405,
    headers: { Allow: "GET, POST", "Cache-Control": "no-store" }
  });
};
