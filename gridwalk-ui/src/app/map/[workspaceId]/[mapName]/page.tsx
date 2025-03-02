import { MapClient } from './components/map-client'

export default async function Map() {
  const apiUrl = process.env.GRIDWALK_API

  if (!apiUrl) {
    throw new Error('GRIDWALK_API environment variable is not set')
  }

  return <MapClient apiUrl={apiUrl} />
}
