// ============================================================
//  PostAI · Supabase client
//  Instale: npm install @supabase/supabase-js
// ============================================================

import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnon) {
  throw new Error('Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não configuradas.')
}

export const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

// ---- Storage helpers ----

/** Faz upload de uma imagem do acervo e retorna a URL pública */
export async function uploadAsset(
  file: File,
  brandId: string,
  category: string
): Promise<{ path: string; url: string }> {
  const ext  = file.name.split('.').pop()
  const path = `${brandId}/${category}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('assets')
    .upload(path, file, { upsert: false, contentType: file.type })

  if (error) throw error

  const { data } = supabase.storage.from('assets').getPublicUrl(path)
  return { path, url: data.publicUrl }
}

/** Faz upload de uma imagem gerada pelo DALL-E (via URL) */
export async function uploadGeneratedImage(
  imageUrl: string,
  postId: string
): Promise<{ path: string; url: string }> {
  const response = await fetch(imageUrl)
  const blob     = await response.blob()
  const path     = `generated/${postId}.webp`

  const { error } = await supabase.storage
    .from('posts')
    .upload(path, blob, { contentType: 'image/webp', upsert: true })

  if (error) throw error

  const { data } = supabase.storage.from('posts').getPublicUrl(path)
  return { path, url: data.publicUrl }
}

/** Deleta um arquivo do Storage */
export async function deleteFile(bucket: string, path: string) {
  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) throw error
}
