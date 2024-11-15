'use server'
import { cookies } from 'next/headers'

export async function getWorkspaces() {
  const cookieStore = await cookies()
  const sid = cookieStore.get('sid')
  const response = await fetch(`${process.env.GRIDWALK_API}/workspaces`, {
    headers: {
      Authorization: `Bearer ${sid?.value}`
    }
  })
  const data = await response.json()

  return data
}
