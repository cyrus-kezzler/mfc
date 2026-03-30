import { login } from '@/app/actions/auth'

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0a' }}>
      <div className="w-full max-w-sm px-6">
        <h1 className="text-2xl font-semibold text-center mb-8" style={{ color: '#f0f0f0' }}>
          MFC Batch Calculator
        </h1>
        <form action={login} className="flex flex-col gap-4">
          <input
            type="password"
            name="password"
            placeholder="Password"
            required
            autoFocus
            className="w-full px-4 py-3 rounded-lg text-base outline-none"
            style={{
              background: '#1a1a1a',
              border: '1px solid #333',
              color: '#f0f0f0',
            }}
          />
          <button
            type="submit"
            className="w-full py-3 rounded-lg font-medium text-base"
            style={{ background: '#e8c96e', color: '#0a0a0a' }}
          >
            Enter
          </button>
          {/* error message rendered server-side via searchParams */}
          <WrongPassword searchParams={searchParams} />
        </form>
      </div>
    </div>
  )
}

async function WrongPassword({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  if (!params.error) return null
  return (
    <p className="text-center text-sm" style={{ color: '#e05252' }}>
      Incorrect password
    </p>
  )
}
