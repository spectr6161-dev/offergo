import { NextResponse } from "next/server";
import { fetchHhJson, getRussianAreaIds, type SuggestionItem } from "../_lib/hh";

type HhEducationSuggestion = {
  acronym?: string | null;
  area?: {
    id?: string;
    name?: string;
  } | null;
  id?: string;
  text?: string;
};

type HhEducationSuggestResponse = {
  items?: HhEducationSuggestion[];
};

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json({ items: [] satisfies SuggestionItem[] });
  }

  try {
    const [russianAreaIds, data] = await Promise.all([
      getRussianAreaIds(),
      fetchHhJson<HhEducationSuggestResponse>(
        `https://api.hh.ru/suggests/educational_institutions?text=${encodeURIComponent(query)}`,
      ),
    ]);
    const items = (data.items ?? [])
      .filter((item) => item.id && item.text && item.area?.id && russianAreaIds.has(item.area.id))
      .map<SuggestionItem>((item) => ({
        id: item.id!,
        label: item.text!,
        source: "hh",
        subtitle: [item.acronym, item.area?.name].filter(Boolean).join(" · ") || undefined,
      }));

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] satisfies SuggestionItem[] });
  }
}
