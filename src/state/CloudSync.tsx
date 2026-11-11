import { useCloudSync } from './useCloudSync'

/** Renders nothing; keeps the signed-in account and this device's data in step. */
export function CloudSync(): null {
  useCloudSync()
  return null
}
