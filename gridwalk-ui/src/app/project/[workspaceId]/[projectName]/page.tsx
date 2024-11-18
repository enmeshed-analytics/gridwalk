import { MapClient } from './components/mapClient'

export default async function Project() {
  const apiUrl = process.env.GRIDWALK_API

  if (!apiUrl) {
    throw new Error('GRIDWALK_API environment variable is not set')
  }

  return <MapClient apiUrl={apiUrl} />
}
