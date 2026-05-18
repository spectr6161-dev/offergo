import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  void req;

  return NextResponse.json(
    {
      error:
        'AI Gateway отключён: редактор не выполняет запросы к зарубежным AI-провайдерам.',
    },
    { status: 503 }
  );
}
