"use client"

import { useEffect, useRef, useState, type ChangeEvent } from "react"
import Image from "next/image"
import {
  ChevronDown,
  Info,
  FileAudio,
  Import,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Repeat,
  SkipBack,
  SkipForward,
  Settings2,
  Trash2,
  Volume2,
  Upload,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import sonataLogo from "./logo.svg"

const initialTracks = [
  { name: "Lead vocal", format: "WAV", active: true },
  { name: "Harmony layer", format: "MP3", active: true },
  { name: "Acoustic guitar", format: "M4A", active: false },
]

const lyrics = [
  { time: "00:08", text: "I found a quiet place to start again", active: false },
  {
    time: "00:14",
    text: "Where every note can find its way back home",
    active: true,
  },
  {
    time: "00:21",
    text: "The room is still, but something is changing",
    active: false,
  },
  { time: "00:28", text: "A little louder than the day before", active: false },
  {
    time: "00:35",
    text: "And I can hear the shape of what comes next",
    active: false,
  },
]

type LyricMetadata = {
  title: string
  artist: string
  album: string
}

export default function Page() {
  const [playing, setPlaying] = useState(false)
  const [repeating, setRepeating] = useState(false)
  const [lyricsUploaded, setLyricsUploaded] = useState(false)
  const [lyricMetadata, setLyricMetadata] = useState<LyricMetadata>({
    title: "Untitled",
    artist: "Unknown artist",
    album: "Unknown album",
  })
  const [mutedTracks, setMutedTracks] = useState<string[]>([])
  const [soloTracks, setSoloTracks] = useState<string[]>([])
  const [tracks, setTracks] = useState(initialTracks)
  const [openTrackMenu, setOpenTrackMenu] = useState<string | null>(null)
  const lyricsInputRef = useRef<HTMLInputElement>(null)
  const trackMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!openTrackMenu) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!trackMenuRef.current?.contains(event.target as Node)) {
        setOpenTrackMenu(null)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)

    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [openTrackMenu])

  const removeTrack = (trackName: string) => {
    setTracks((currentTracks) =>
      currentTracks.filter((track) => track.name !== trackName)
    )
    setMutedTracks((currentTracks) =>
      currentTracks.filter((currentTrack) => currentTrack !== trackName)
    )
    setSoloTracks((currentTracks) =>
      currentTracks.filter((currentTrack) => currentTrack !== trackName)
    )
    setOpenTrackMenu(null)
  }

  const handleLyricsUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) return

    const content = await file.text()
    const metadata = { ...lyricMetadata }

    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\[(ti|ar|al):([^\]]*)\]\s*$/i)

      if (!match) continue

      const tag = match[1]
      const value = match[2]

      if (!tag || value === undefined) continue

      if (tag.toLowerCase() === "ti") metadata.title = value.trim()
      if (tag.toLowerCase() === "ar") metadata.artist = value.trim()
      if (tag.toLowerCase() === "al") metadata.album = value.trim()
    }

    setLyricMetadata(metadata)
    setLyricsUploaded(true)
    event.target.value = ""
  }

  return (
    <main className="min-h-svh bg-background text-foreground selection:bg-accent">
      <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-border bg-background/95 px-5 backdrop-blur sm:px-8">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-secondary text-primary-foreground">
            <Image
              src={sonataLogo}
              alt="Sonata"
              className="size-5 object-contain"
              priority
            />
          </div>
          <span className="text-sm font-semibold tracking-[0.18em] uppercase">
            Sonata
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" aria-label="Open Info">
            <Info />
          </Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-370 grid-cols-1 gap-0 pt-16 lg:grid-cols-[360px_1fr]">
        <aside className="order-last border-b border-border p-5 sm:p-6 lg:order-0 lg:sticky lg:top-16 lg:flex lg:h-[calc(100vh-9rem)] lg:flex-col lg:overflow-hidden lg:border-r lg:border-b-0">
          <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1 scrollbar-track-transparent hover:scrollbar-thumb-white/5">
            {tracks.length > 0 ? (
              <div className="space-y-3 p-4">
                {tracks.map((track) => (
                  <div
                    key={track.name}
                    className="group relative rounded-xl border border-border bg-card p-2.5"
                  >
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <FileAudio className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {track.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {track.format} · 04:32
                      </p>
                    </div>
                    <div
                      ref={trackMenuRef}
                      className="relative"
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`More options for ${track.name}`}
                        aria-expanded={openTrackMenu === track.name}
                        onPointerDown={() =>
                          setOpenTrackMenu((currentTrack) =>
                            currentTrack === track.name ? null : track.name
                          )
                        }
                      >
                        <MoreHorizontal />
                      </Button>
                      {openTrackMenu === track.name && (
                        <div className="absolute top-10 right-0 z-10 min-w-36 rounded-lg border border-border bg-background p-1 shadow-lg">
                          <button
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium hover:bg-muted"
                            onClick={() => setOpenTrackMenu(null)}
                          >
                            <Pencil className="size-3.5" />
                            Rename track
                          </button>
                          <button
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium hover:bg-muted"
                            onClick={() => setOpenTrackMenu(null)}
                          >
                            <RefreshCw className="size-3.5" />
                            Replace track
                          </button>
                          <div className="my-1 border-t border-border" />
                          <button
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium text-destructive hover:bg-destructive/10"
                            onClick={() => removeTrack(track.name)}
                          >
                            <Trash2 className="size-3.5" />
                            Remove track
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2 border-t border-border pt-2">
                    <button
                      className={`rounded-md px-2 py-1 text-[10px] font-bold tracking-[0.12em] ${mutedTracks.includes(track.name) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                      aria-pressed={mutedTracks.includes(track.name)}
                      onClick={() =>
                        setMutedTracks((currentTracks) =>
                          currentTracks.includes(track.name)
                            ? currentTracks.filter(
                                (currentTrack) => currentTrack !== track.name
                              )
                            : [...currentTracks, track.name]
                        )
                      }
                    >
                      MUTE
                    </button>
                    <button
                      className={`rounded-md px-2 py-1 text-[10px] font-bold tracking-[0.12em] ${soloTracks.includes(track.name) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                      aria-pressed={soloTracks.includes(track.name)}
                      onClick={() =>
                        setSoloTracks((currentTracks) =>
                          currentTracks.includes(track.name)
                            ? currentTracks.filter(
                                (currentTrack) => currentTrack !== track.name
                              )
                            : [...currentTracks, track.name]
                        )
                      }
                    >
                      SOLO
                    </button>
                    <div className="ml-auto flex items-center gap-2 text-muted-foreground">
                      <Volume2 className="size-3.5" />
                      <div className="h-1 w-16 rounded-full bg-muted">
                        <div
                          className={`h-1 rounded-full bg-primary ${track.active ? "w-4/5" : "w-1/2"}`}
                        />
                      </div>
                    </div>
                  </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex min-h-full flex-col items-center justify-center px-6 py-16 text-center">
                <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-dashed border-border bg-muted text-muted-foreground">
                  <FileAudio className="size-6" />
                </div>
                <h2 className="text-sm font-semibold">No tracks uploaded</h2>
                <p className="mt-2 max-w-52 text-xs leading-5 text-muted-foreground">
                  Add an audio file to start mixing.
                </p>
              </div>
            )}
          </div>
          <button className="mt-3 flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-xs font-medium text-muted-foreground hover:border-foreground">
            <Plus className="size-4" /> Add track
          </button>
        </aside>

        <section className="order-first min-w-0 px-5 py-5 sm:px-8 sm:py-7 lg:order-0">
          <div className="mx-auto max-w-2xl">
            {lyricsUploaded ? (
              <div className="relative overflow-hidden rounded-2xl border border-border bg-card px-5 py-5 sm:px-8 sm:py-7 lg:sticky lg:top-24">
                <div className="absolute top-0 left-0 h-1 w-[42%] bg-primary" />
                <div className="mb-5 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                  <div className="min-w-0">
                    <span>LYRICS</span>
                    <div className="mt-2 space-y-0.5 text-sm text-foreground">
                      <p className="truncate font-medium">{lyricMetadata.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {lyricMetadata.artist} · {lyricMetadata.album}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>02:14 / 04:32</span>
                    <Button
                      variant="destructive"
                      size="icon-xs"
                      aria-label="Remove uploaded lyrics"
                      title="Remove uploaded lyrics"
                      onClick={() => {
                        setLyricsUploaded(false)
                        setLyricMetadata({
                          title: "Untitled",
                          artist: "Unknown artist",
                          album: "Unknown album",
                        })
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <div className="max-h-[40svh] space-y-4 overflow-y-auto pr-2 scrollbar-track-transparent hover:scrollbar-thumb-white/5 lg:max-h-[calc(100vh-24rem)]">
                  {lyrics.map((line) => (
                    <div
                      key={line.time}
                      className={`grid grid-cols-[42px_1fr] gap-4 transition-opacity ${line.active ? "opacity-100" : "opacity-35"}`}
                    >
                      <span
                        className={`pt-1 font-mono text-[11px] ${line.active ? "text-primary" : "text-muted-foreground"}`}
                      >
                        {line.time}
                      </span>
                      <p
                        className={`${line.active ? "text-xl font-medium sm:text-2xl" : "text-base"}`}
                      >
                        {line.text}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-7 h-8 border-t border-border pt-2">
                  <div className="flex h-full items-end gap-1 opacity-50">
                    {Array.from({ length: 60 }, (_, index) => (
                      <span
                        key={index}
                        className="w-full rounded-t-sm bg-primary"
                        style={{ height: `${18 + ((index * 17) % 68)}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative flex min-h-80 flex-col items-center justify-center overflow-hidden rounded-2xl border border-border bg-card px-5 py-8 text-center sm:px-8 lg:sticky lg:top-24">
                <div className="absolute top-0 left-0 h-1 w-full bg-muted" />
                <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <FileAudio className="size-7" />
                </div>
                <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                  Lyrics
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
                  No lyrics uploaded
                </h2>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  Add an LRC file to display synchronized lyrics with your tracks.
                </p>
                <Button
                  className="mt-6"
                  size="sm"
                  onClick={() => lyricsInputRef.current?.click()}
                >
                  <Upload /> Upload lyrics
                </Button>
                <input
                  id="lyrics-upload"
                  ref={lyricsInputRef}
                  className="sr-only"
                  type="file"
                  accept=".lrc,text/plain"
                  onChange={handleLyricsUpload}
                />
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Supported format: .lrc
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      <footer className="sticky bottom-0 border-t border-border bg-background/95 px-5 py-3 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          <div className="flex items-center justify-center gap-4 sm:gap-8">
            <Button variant="ghost" size="icon-sm" aria-label="Volume" title="Volume">
              <Volume2 />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Previous track" title="Previous track">
              <SkipBack />
            </Button>
            <Button
              variant="default"
              size="icon-lg"
              aria-label={playing ? "Pause" : "Play"}
              onClick={() => setPlaying(!playing)}
            >
              {playing ? <Pause /> : <Play />}
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Next track" title="Next track">
              <SkipForward />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Repeat"
              title="Repeat"
              aria-pressed={repeating}
              className={repeating ? "text-primary" : undefined}
              onClick={() => setRepeating(!repeating)}
            >
              <Repeat />
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] text-muted-foreground">
              02:14
            </span>
            <div className="h-1 flex-1 rounded-full bg-muted">
              <div className="h-1 w-[42%] rounded-full bg-primary" />
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">
              04:32
            </span>
          </div>
        </div>
      </footer>
    </main>
  )
}
