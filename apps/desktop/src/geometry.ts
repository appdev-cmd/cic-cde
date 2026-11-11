import type { GeometryRef } from "./types";
const buffers = new Map<string, Promise<ArrayBuffer>>();
export async function geometryBuffer(
  id: string,
  publicFile?: string,
): Promise<ArrayBuffer> {
  let value = buffers.get(id);
  if (!value) {
    value = (async () => {
      if (publicFile) {
        const response = await fetch(
          `/geometry/${encodeURIComponent(publicFile)}`,
        );
        if (!response.ok) throw new Error("Demo geometry asset missing");
        return response.arrayBuffer();
      }
      const { API, cloudEnabled, localDesktop, sessionHeaders } = await import("./bridge");
      if (localDesktop) {
        const { invoke } = await import("@tauri-apps/api/core");
        return invoke<ArrayBuffer>("geometry_read", { assetId: id });
      }
      if (cloudEnabled) {
        const { cloudRpc, supabase } = await import("./cloud");
        const asset = await cloudRpc<{ storagePath: string }>("geometry.get", { id });
        const { data, error } = await supabase.storage.from("cde-files").download(asset.storagePath);
        if (error) throw error;
        return data.arrayBuffer();
      }
      const response = await fetch(
        `${API}/geometry/${encodeURIComponent(id)}`,
        { credentials: "include", headers: sessionHeaders() },
      );
      if (!response.ok) throw new Error(`Geometry asset unavailable: ${id}`);
      return response.arrayBuffer();
    })();
    buffers.set(id, value);
    value.catch(() => buffers.delete(id));
    // Evict lookup references; resident Three.js attributes retain their own buffers.
    if (buffers.size > 32) buffers.delete(buffers.keys().next().value!);
  }
  return value;
}
export function geometryViews(buffer: ArrayBuffer, ref: GeometryRef) {
  const view = new DataView(buffer);
  if (
    buffer.byteLength < 16 ||
    view.getUint32(0, true) !== 0x314d4251 ||
    view.getUint32(4, true) !== 1
  )
    throw new Error("Unsupported geometry cache");
  const nv = view.getUint32(8, true),
    ni = view.getUint32(12, true);
  if (
    buffer.byteLength !== 16 + 4 * (nv + ni) ||
    ref.vertexOffset + ref.vertexCount > nv ||
    ref.indexOffset + ref.indexCount > ni ||
    ref.vertexCount % 3 ||
    ref.indexCount % 3
  )
    throw new Error("Invalid geometry ranges");
  const vertices = new Float32Array(
    buffer,
    16 + ref.vertexOffset * 4,
    ref.vertexCount,
  );
  const indices = new Uint32Array(
    buffer,
    16 + (nv + ref.indexOffset) * 4,
    ref.indexCount,
  );
  if (indices.some((index) => index >= vertices.length / 3))
    throw new Error("Invalid triangle indices");
  return { vertices, indices };
}
