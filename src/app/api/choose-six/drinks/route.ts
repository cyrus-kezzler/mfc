// src/app/api/choose-six/drinks/route.ts
// Public, browser-facing endpoint that feeds the Choose Six box builder on
// myattsfields.london/products/boxset. The widget script (served from
// /choose-six-widget.js) fetches this on page load.
//
// CORS is handled by the shared allowlist in @/lib/cors. Do NOT hardcode a
// single origin here: that is what killed this endpoint when the shop moved
// from mfc.london to myattsfields.london.

import { NextRequest, NextResponse } from 'next/server'
import {
  CHOOSE_SIX_DRINKS,
  CHOOSE_SIX_PRESETS,
} from '@/data/choose-six-drinks'
import { corsHeaders } from '@/lib/cors'

const CACHE = 'public, s-maxage=300, stale-while-revalidate=86400'

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(request.headers.get('origin'), {
      methods: 'GET, OPTIONS',
      cacheControl: CACHE,
    }),
  })
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      drinks: CHOOSE_SIX_DRINKS,
      presets: CHOOSE_SIX_PRESETS,
    },
    {
      headers: corsHeaders(request.headers.get('origin'), {
        methods: 'GET, OPTIONS',
        cacheControl: CACHE,
      }),
    },
  )
}
