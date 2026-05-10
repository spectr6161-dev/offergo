import { NextResponse } from "next/server";
import { fetchHhJson, isRussianArea, type SuggestionItem } from "../_lib/hh";

type HhAreaSuggestion = {
  id?: string;
  parent?: HhAreaSuggestion | null;
  text?: string;
};

type HhAreaSuggestResponse = {
  items?: HhAreaSuggestion[];
};

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json({ items: [] satisfies SuggestionItem[] });
  }

  try {
    const data = await fetchHhJson<HhAreaSuggestResponse>(
      `https://api.hh.ru/suggests/area_leaves?text=${encodeURIComponent(query)}`,
    );
    const items = (data.items ?? [])
      .filter((item) => item.id && item.text && isRussianArea(item.parent))
      .map<SuggestionItem>((item) => ({
        id: item.id!,
        label: item.text!,
        source: "hh",
        subtitle: item.parent?.text,
      }));

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] satisfies SuggestionItem[] });
  }
}
