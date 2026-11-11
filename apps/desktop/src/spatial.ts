import type { BimElement } from "./types";

const collator = new Intl.Collator("vi", { numeric: true });

export function spaceKey(element: BimElement) {
  return element.space ? `${element.modelId}:${element.space.id}` : null;
}

export function spaceLabel(space: NonNullable<BimElement["space"]>) {
  const title = [space.number, space.name].filter(Boolean).join(" · ");
  return title ? `Phòng ${title}` : "Phòng chưa đặt tên";
}

export function storeyLabel(storey: string) {
  return storey === "Unassigned" ? "Chưa phân tầng" : storey;
}

export function groupByStorey(elements: BimElement[]) {
  const storeys = new Map<
    string,
    {
      name: string;
      count: number;
      rooms: Map<string, { label: string; count: number }>;
    }
  >();

  for (const element of elements) {
    let storey = storeys.get(element.storey);
    if (!storey) {
      storey = { name: element.storey, count: 0, rooms: new Map() };
      storeys.set(element.storey, storey);
    }
    storey.count++;
    const key = spaceKey(element);
    if (key && element.space) {
      const room = storey.rooms.get(key) ?? {
        label: spaceLabel(element.space),
        count: 0,
      };
      room.count++;
      storey.rooms.set(key, room);
    }
  }

  return [...storeys.values()]
    .sort((a, b) => {
      if (a.name === "Unassigned") return 1;
      if (b.name === "Unassigned") return -1;
      return collator.compare(a.name, b.name);
    })
    .map((storey) => ({
      ...storey,
      rooms: [...storey.rooms].sort(([, a], [, b]) =>
        collator.compare(a.label, b.label),
      ),
    }));
}
