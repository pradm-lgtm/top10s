import { cookies } from 'next/headers'
import { createHash } from 'crypto'

export function getAdminToken(): string {
  const password = process.env.ADMIN_PASSWORD ?? ''
  return createHash('sha256').update(`admin:${password}`).digest('hex')
}

export async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_token')?.value
  if (!token) return false
  return token === getAdminToken()
}
