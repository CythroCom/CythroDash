import { NextRequest, NextResponse } from 'next/server'
import zlib from 'zlib'

// Return a compressed JSON response (br > gzip > identity)
export function compressedJson(request: NextRequest, data: any, status: number = 200, extraHeaders: Record<string,string> = {}) {
  const accept = (request.headers.get('accept-encoding') || '').toLowerCase()
  const json = Buffer.from(JSON.stringify(data))

  if (accept.includes('br') && zlib.brotliCompressSync) {
    const body = zlib.brotliCompressSync(json)
    return new NextResponse(body as unknown as BodyInit, {
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Encoding': 'br',
        'Vary': 'Accept-Encoding',
        ...extraHeaders,
      }
    })
  }

  if (accept.includes('gzip')) {
    const body = zlib.gzipSync(json)
    return new NextResponse(body as unknown as BodyInit, {
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Encoding': 'gzip',
        'Vary': 'Accept-Encoding',
        ...extraHeaders,
      }
    })
  }

  // Fallback: uncompressed
  return NextResponse.json(data, { status, headers: { 'Vary': 'Accept-Encoding', ...extraHeaders } })
}

