type HhAreaNode = {
  areas?: HhAreaNode[];
  id?: string;
  name?: string;
  parent?: HhAreaNode | null;
  text?: string;
};

export type SuggestionItem = {
  id: string;
  label: string;
  source: "hh";
  subtitle?: string;
};

const hhHeaders = {
  Accept: "application/json",
  "User-Agent": "OfferGO resume wizard (support@offergo.local)",
};

let russianAreaIdsPromise: Promise<Set<string>> | null = null;

function collectAreaIds(area: HhAreaNode, ids: Set<string>) {
  if (area.id) {
    ids.add(area.id);
  }

  for (const child of area.areas ?? []) {
    collectAreaIds(child, ids);
  }
}

export function isRussianArea(area: HhAreaNode | null | undefined) {
  let current = area;

  while (current) {
    if (current.id === "113" || current.text === "Россия" || current.name === "Россия") {
      return true;
    }

    current = current.parent;
  }

  return false;
}

export async function getRussianAreaIds() {
  if (!russianAreaIdsPromise) {
    russianAreaIdsPromise = fetch("https://api.hh.ru/areas/113", {
      headers: hhHeaders,
      cache: "force-cache",
      next: { revalidate: 60 * 60 * 24 },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HH areas request failed: ${response.status}`);
        }

        return (await response.json()) as HhAreaNode;
      })
      .then((root) => {
        const ids = new Set<string>();

        collectAreaIds(root, ids);

        return ids;
      })
      .catch((error) => {
        russianAreaIdsPromise = null;
        throw error;
      });
  }

  return russianAreaIdsPromise;
}

export async function fetchHhJson<T>(url: string, signal?: AbortSignal) {
  const response = await fetch(url, {
    headers: hhHeaders,
    signal,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`HH request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}
