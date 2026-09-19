import { create } from 'zustand'

export interface Track {
  id: string
  name: string
  file: File
  muted: boolean
  soloed: boolean
  volume: number // Pro feature
}

interface SonataStore {
  // Playback State
  isPlaying: boolean
  currentTime: number
  duration: number
  masterVolume: number

  // Files & Tracks (Separated)
  tracks: Track[]
  lyricFile: File | null
  lyricContent: string | null

  // Playback Actions
  togglePlay: () => void
  setIsPlaying: (isPlaying: boolean) => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setMasterVolume: (volume: number) => void

  // Audio Track Actions (Max 3 on Free Tier)
  addAudioFiles: (files: File[]) => void
  removeTrack: (id: string) => void
  removeAllTracks: () => void
  toggleMute: (id: string) => void
  toggleSolo: (id: string) => void
  setTrackVolume: (id: string, volume: number) => void

  // Lyric File Actions (Max 1 .lrc file)
  setLyricFile: (file: File | null, content?: string | null) => void
  removeLyricFile: () => void
}

const MAX_FREE_TRACKS = 3

export const useSonataStore = create<SonataStore>((set, get) => ({
  // Initial States
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  masterVolume: 1.0,
  tracks: [],
  lyricFile: null,
  lyricContent: null,

  // Playback Controls
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setMasterVolume: (masterVolume) => set({ masterVolume }),

  // Dedicated Audio Ingestion (Filters for WAV, MP3, M4A & Enforces Free Limit)
  addAudioFiles: (newFiles) => {
    const currentTracks = get().tracks
    const validAudio = newFiles.filter((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase()
      return ['wav', 'mp3', 'm4a'].includes(ext || '')
    })

    const availableSlots = MAX_FREE_TRACKS - currentTracks.length
    const filesToAdd = validAudio.slice(0, availableSlots)

    const newTrackObjects: Track[] = filesToAdd.map((file, index) => ({
      id: `${Date.now()}-${index}-${Math.random().toString(36).substring(2, 7)}`,
      name: file.name,
      file,
      muted: false,
      soloed: false,
      volume: 1.0,
    }))

    set({ tracks: [...currentTracks, ...newTrackObjects] })
  },

  removeTrack: (id) =>
    set((state) => ({
      tracks: state.tracks.filter((t) => t.id !== id),
    })),

  removeAllTracks: () => set({ tracks: [] }),

  toggleMute: (id) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === id ? { ...t, muted: !t.muted } : t
      ),
    })),

  toggleSolo: (id) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === id ? { ...t, soloed: !t.soloed } : t
      ),
    })),

  setTrackVolume: (id, volume) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === id ? { ...t, volume } : t
      ),
    })),

  // Dedicated Lyric Management
  setLyricFile: (file, content = null) =>
    set({ lyricFile: file, lyricContent: content }),

  removeLyricFile: () =>
    set({ lyricFile: null, lyricContent: null }),
}))