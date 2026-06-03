import { NextResponse } from 'next/server'
import { validateWikiTitle } from '@/lib/wikipedia.js'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title')?.trim()
  if (!title) return NextResponse.json({ valid: false })
  const result = await validateWikiTitle(title)
  return NextResponse.json(result)
}
