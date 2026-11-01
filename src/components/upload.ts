import { useStore } from '../store'
import { uploadAsset } from '../lib/supabase'
import { dataUrlToBlob, readImage } from '../lib/io'
import { useToast } from './ui'

/** Resize an image in the browser, then store it in Supabase so signatures reference a hosted URL. */
export function useImageUpload() {
  const toast = useToast()
  const { org } = useStore()
  return async (file: File, name: string, max = 360): Promise<string | null> => {
    if (!file.type.startsWith('image/')) { toast('Please choose an image file'); return null }
    if (file.size > 8 * 1024 * 1024) { toast('Images must be under 8 MB'); return null }
    try {
      const resized = file.type === 'image/svg+xml' ? file : await dataUrlToBlob(await readImage(file, max))
      return await uploadAsset(org.id, resized, name)
    } catch (e) {
      toast(`Upload failed: ${(e as Error).message}`)
      return null
    }
  }
}
