import { ImageResponse } from 'next/og'
import { readFileSync } from 'fs'
import { join } from 'path'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  const logoData = readFileSync(join(process.cwd(), 'public', 'MFC Logo - Standard.png'))
  const base64 = `data:image/png;base64,${logoData.toString('base64')}`

  return new ImageResponse(
    (
      <div
        style={{
          background: '#080808',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={base64}
          alt="MFC"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>
    ),
    { ...size }
  )
}
