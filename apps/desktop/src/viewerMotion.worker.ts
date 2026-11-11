import { MeshoptSimplifier } from "meshoptimizer";

export type MotionRange = {
  start: number;
  count: number;
  vertexStart: number;
  vertexCount: number;
};

type Job = {
  positions: Float32Array<ArrayBuffer>;
  indices: Uint32Array<ArrayBuffer>;
  ranges: MotionRange[];
};

self.onmessage = async ({ data }: MessageEvent<Job>) => {
  try {
    if (!MeshoptSimplifier.supported) {
      self.postMessage(null);
      return;
    }
    await MeshoptSimplifier.ready;
    const { positions, indices, ranges } = data;
    const output = new Uint32Array(indices.length);
    const counts: number[] = [];
    let end = 0;
    for (const { start, count, vertexStart, vertexCount } of ranges) {
      const source = indices.subarray(start, start + count);
      if (count < 180) {
        output.set(source, end);
        counts.push(count);
        end += count;
        continue;
      }
      const localIndices = source.map((index) => index - vertexStart);
      const vertices = positions.subarray(vertexStart * 3, (vertexStart + vertexCount) * 3);
      const target = Math.max(36, Math.floor(count * 0.22 / 3) * 3);
      const [reduced] = MeshoptSimplifier.simplify(
        localIndices, vertices, 3, target, 0.035, ["Sparse", "LockBorder"],
      );
      if (reduced.length === 0 || reduced.length >= count) {
        output.set(source, end);
        counts.push(count);
        end += count;
        continue;
      }
      for (let i = 0; i < reduced.length; i++) output[end + i] = reduced[i] + vertexStart;
      counts.push(reduced.length);
      end += reduced.length;
    }
    if (end >= indices.length * 0.9) {
      self.postMessage(null);
      return;
    }
    const simplified = output.slice(0, end);
    self.postMessage({ indices: simplified, counts }, { transfer: [simplified.buffer] });
  } catch {
    self.postMessage(null);
  }
};
