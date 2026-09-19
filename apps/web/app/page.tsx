"use client"

import { useEffect, useRef, useState, type ChangeEvent } from "react"
import Image from "next/image"
import {
  Info,
  FileAudio,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Repeat,
  RepeatOff,
  RotateCcw,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
  Upload,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import sonataLogo from "./logo.svg"

import { useSonataStore } from "../lib/store"

const defaultLyricMetadata = {
  title: "Untitled",
  artist: "Unknown artist",
  album: "Unknown album",
}

const createFlatVisualizerBars = () => Array.from({ length: 60 }, () => 18)

const formatTime = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds % 60

  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`
}

const parseLyrics = (content: string | null) => {
  const metadata = { ...defaultLyricMetadata }
  const lines: { timestamp: number; time: string; text: string }[] = []

  if (!content) return { metadata, lines }

  for (const line of content.split(/\r?\n/)) {
    const metadataMatch = line.match(/^\[(ti|ar|al):([^\]]*)\]\s*$/i)
    const lyricMatch = line.match(
      /^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\](.*)$/
    )

    if (metadataMatch) {
      const tag = metadataMatch[1]?.toLowerCase()
      const value = metadataMatch[2]?.trim()

      if (tag === "ti" && value) metadata.title = value
      if (tag === "ar" && value) metadata.artist = value
      if (tag === "al" && value) metadata.album = value
    }

    if (lyricMatch) {
      const minutes = Number(lyricMatch[1])
      const seconds = Number(lyricMatch[2])
      const fraction = lyricMatch[3] ? Number(`0.${lyricMatch[3]}`) : 0

      lines.push({
        timestamp: minutes * 60 + seconds + fraction,
        time: `${lyricMatch[1]?.padStart(2, "0")}:${lyricMatch[2]}`,
        text: lyricMatch[4]?.trim() ?? "",
      })
    }
  }

  lines.sort((left, right) => left.timestamp - right.timestamp)

  return { metadata, lines }
}

export default function Page() {
  const {
    isPlaying,
    currentTime,
    duration,
    masterVolume,
    tracks,
    lyricFile,
    lyricContent,
    togglePlay,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    addAudioFiles,
    toggleMute,
    toggleSolo,
    removeTrack,
    removeAllTracks,
    setLyricFile,
    removeLyricFile,
  } = useSonataStore()
  const [repeating, setRepeating] = useState(false)
  const [visualizerBars, setVisualizerBars] = useState(createFlatVisualizerBars)
  const [openTrackMenu, setOpenTrackMenu] = useState<string | null>(null)
  const [openLyricMenu, setOpenLyricMenu] = useState(false)
  const lyricsInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  const audioElementsRef = useRef(new Map<string, HTMLAudioElement>())
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceNodesRef = useRef(new Map<string, MediaElementAudioSourceNode>())
  const visualizerFrameRef = useRef<number | null>(null)
  const activeLyricRef = useRef<HTMLDivElement | null>(null)
  const repeatingRef = useRef(repeating)
  const currentTimeRef = useRef(currentTime)
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const trackMenuRef = useRef<HTMLDivElement>(null)
  const lyricMenuRef = useRef<HTMLDivElement>(null)
  const { metadata: lyricMetadata, lines: lyrics } = parseLyrics(lyricContent)
  const progress = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0
  const trackIds = tracks.map((track) => track.id).join("|")
  const activeLyricIndex = lyrics.reduce(
    (activeIndex, line, index) =>
      line.timestamp <= currentTime ? index : activeIndex,
    -1
  )

  useEffect(() => {
    currentTimeRef.current = currentTime
  }, [currentTime])

  useEffect(() => {
    repeatingRef.current = repeating
  }, [repeating])

  useEffect(() => {
    activeLyricRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    })
  }, [activeLyricIndex])

  useEffect(() => {
    const audioElements = audioElementsRef.current
    const sourceNodes = sourceNodesRef.current
    const currentTrackIds = new Set(tracks.map((track) => track.id))

    for (const [trackId, audio] of audioElements) {
      if (!currentTrackIds.has(trackId)) {
        audio.pause()
        sourceNodes.get(trackId)?.disconnect()
        sourceNodes.delete(trackId)
        URL.revokeObjectURL(audio.src)
        audioElements.delete(trackId)
      }
    }

    for (const track of tracks) {
      if (audioElements.has(track.id)) continue

      const audio = new Audio(URL.createObjectURL(track.file))
      audio.preload = "metadata"
      const audioContext =
        audioContextRef.current ?? new AudioContext()
      const analyser = analyserRef.current ?? audioContext.createAnalyser()

      if (!audioContextRef.current) {
        audioContextRef.current = audioContext
        analyser.fftSize = 128
        analyser.smoothingTimeConstant = 0.8
        analyser.connect(audioContext.destination)
        analyserRef.current = analyser
      }

      sourceNodes.set(track.id, audioContext.createMediaElementSource(audio))
      sourceNodes.get(track.id)?.connect(analyser)
      if (currentTimeRef.current > 0) {
        audio.currentTime = currentTimeRef.current
      }
      audio.addEventListener("loadedmetadata", () => {
        const durations = Array.from(audioElements.values())
          .map((element) => element.duration)
          .filter(Number.isFinite)
        setDuration(durations.length > 0 ? Math.max(...durations) : 0)
      })
      audio.addEventListener("timeupdate", () => {
        const primaryAudio = audioElementsRef.current.values().next().value

        if (audio === primaryAudio) {
          setCurrentTime(audio.currentTime)
        }
      })
      audio.addEventListener("ended", () => {
        const activeAudio = Array.from(audioElementsRef.current.values()).some(
          (element) => !element.ended
        )

        if (activeAudio) return

        for (const element of audioElementsRef.current.values()) {
          element.currentTime = 0
        }
        setCurrentTime(0)

        if (!repeatingRef.current) {
          audioElementsRef.current.forEach((element) => element.pause())
          setIsPlaying(false)
          return
        }

        void Promise.all(
          Array.from(audioElementsRef.current.values()).map((element) =>
            element.play()
          )
        )
      })
      audioElements.set(track.id, audio)
    }

    if (tracks.length === 0) {
      setCurrentTime(0)
      setDuration(0)
    }

  }, [setCurrentTime, setDuration, setIsPlaying, trackIds, tracks])

  useEffect(() => {
    const audioElements = audioElementsRef.current
    const sourceNodes = sourceNodesRef.current

    return () => {
      for (const audio of audioElements.values()) {
        audio.pause()
        URL.revokeObjectURL(audio.src)
      }
      for (const source of sourceNodes.values()) {
        source.disconnect()
      }
      analyserRef.current?.disconnect()
      void audioContextRef.current?.close()
      audioElements.clear()
      sourceNodes.clear()
    }
  }, [])

  useEffect(() => {
    const analyser = analyserRef.current

    if (!analyser || !isPlaying || tracks.length === 0) {
      setVisualizerBars(createFlatVisualizerBars())
      if (visualizerFrameRef.current) {
        cancelAnimationFrame(visualizerFrameRef.current)
        visualizerFrameRef.current = null
      }
      return
    }

    const frequencyData = new Uint8Array(analyser.frequencyBinCount)
    const updateVisualizer = () => {
      analyser.getByteFrequencyData(frequencyData)
      setVisualizerBars(
        Array.from({ length: 60 }, (_, index) => {
          const start = Math.floor(
            (index * frequencyData.length) / 60
          )
          const end = Math.max(
            start + 1,
            Math.floor(((index + 1) * frequencyData.length) / 60)
          )
          const band = frequencyData.slice(start, end)
          const average =
            band.reduce((total, value) => total + value, 0) / band.length

          return 18 + (average / 255) * 82
        })
      )
      visualizerFrameRef.current = requestAnimationFrame(updateVisualizer)
    }

    updateVisualizer()

    return () => {
      if (visualizerFrameRef.current) {
        cancelAnimationFrame(visualizerFrameRef.current)
        visualizerFrameRef.current = null
      }
    }
  }, [isPlaying, tracks.length])

  useEffect(() => {
    const audioElements = audioElementsRef.current
    const hasSoloedTrack = tracks.some((track) => track.soloed)

    tracks.forEach((track) => {
      const audio = audioElements.get(track.id)
      if (!audio) return

      audio.volume =
        track.muted || (hasSoloedTrack && !track.soloed)
          ? 0
          : track.volume * masterVolume
    })
  }, [masterVolume, tracks])

  useEffect(() => {
    const audioElements = Array.from(audioElementsRef.current.values())
    const primaryAudio = audioElements[0]

    if (!primaryAudio) return

    const syncTracks = () => {
      const masterTime = primaryAudio.currentTime

      for (const audio of audioElements.slice(1)) {
        if (!Number.isFinite(audio.currentTime)) continue

        if (Math.abs(audio.currentTime - masterTime) > 0.08) {
          audio.currentTime = masterTime
        }
      }
    }

    if (isPlaying) {
      void audioContextRef.current?.resume()
      for (const audio of audioElements) {
        audio.currentTime = currentTimeRef.current
      }

      void Promise.all(audioElements.map((audio) => audio.play()))
      syncIntervalRef.current = setInterval(syncTracks, 250)
    } else {
      audioElements.forEach((audio) => audio.pause())
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
        syncIntervalRef.current = null
      }
    }
  }, [isPlaying, tracks])

  useEffect(() => {
    if (!openTrackMenu && !openLyricMenu) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node

      if (!trackMenuRef.current?.contains(target)) {
        setOpenTrackMenu(null)
      }

      if (!lyricMenuRef.current?.contains(target)) {
        setOpenLyricMenu(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)

    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [openTrackMenu, openLyricMenu])

  const handleAudioUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])

    if (files.length > 0) addAudioFiles(files)

    event.target.value = ""
  }

  const handleLyricsUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) return

    const content = await file.text()
    setLyricFile(file, content)
    event.target.value = ""
  }

  const handleSkip = (seconds: number) => {
    const nextTime = Math.min(
      Math.max(currentTimeRef.current + seconds, 0),
      duration
    )

    currentTimeRef.current = nextTime
    setCurrentTime(nextTime)

    for (const audio of audioElementsRef.current.values()) {
      audio.currentTime = nextTime
    }
  }

  const handlePlayFromStart = () => {
    currentTimeRef.current = 0
    setCurrentTime(0)
    setIsPlaying(true)
    void audioContextRef.current?.resume()

    const audioElements = Array.from(audioElementsRef.current.values())

    for (const audio of audioElements) {
      audio.currentTime = 0
    }

    void Promise.all(audioElements.map((audio) => audio.play()))
  }

  console.log({visualizerBars})
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
          <span className="text-md font-semibold tracking-[0.18em] uppercase">
            Sonata<sup className="text-xs text-muted-foreground">beta</sup>
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
                    key={track.id}
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
                          {track.file.name.split(".").pop()?.toUpperCase()} · 04:32
                        </p>
                      </div>
                      <div
                        ref={openTrackMenu === track.id ? trackMenuRef : undefined}
                        className="relative"
                        onPointerDown={(event) => event.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`More options for ${track.name}`}
                          aria-expanded={openTrackMenu === track.id}
                          onPointerDown={() =>
                            setOpenTrackMenu(
                              openTrackMenu === track.id ? null : track.id
                            )
                          }
                        >
                          <MoreHorizontal />
                        </Button>
                        {openTrackMenu === track.id && (
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
                              onClick={() => {
                                setOpenTrackMenu(null)
                                removeTrack(track.id)
                              }}
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
                        className={`rounded-md px-2 py-1 text-[10px] font-bold tracking-[0.12em] ${track.muted ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                        aria-pressed={track.muted}
                        onClick={() => toggleMute(track.id)}
                      >
                        MUTE
                      </button>
                      <button
                        className={`rounded-md px-2 py-1 text-[10px] font-bold tracking-[0.12em] ${track.soloed ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                        aria-pressed={track.soloed}
                        onClick={() => toggleSolo(track.id)}
                      >
                        SOLO
                      </button>
                      <div className="ml-auto flex items-center gap-2 text-muted-foreground">
                        <Volume2 className="size-3.5" />
                        <div className="h-1 w-16 rounded-full bg-muted">
                          <div
                            className={`h-1 rounded-full bg-primary ${track.volume > 0.5 ? "w-4/5" : "w-1/2"}`}
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
          <div className="mt-3 flex shrink-0 gap-2">
            <button
              className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-xs font-medium text-muted-foreground hover:border-foreground"
              onClick={() => audioInputRef.current?.click()}
            >
              <Plus className="size-4" /> Add track
            </button>
            <button
              className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-dashed border-border text-muted-foreground hover:border-destructive hover:text-destructive disabled:pointer-events-none disabled:opacity-35"
              aria-label="Remove all tracks"
              title="Remove all tracks"
              disabled={tracks.length === 0}
              onClick={removeAllTracks}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
          <input
            ref={audioInputRef}
            className="sr-only"
            type="file"
            accept=".wav,.mp3,.m4a,audio/wav,audio/mpeg,audio/mp4"
            multiple
            onChange={handleAudioUpload}
          />
          {tracks.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <div className="mb-2 flex items-center justify-between text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                <span>Mix</span>
                <span>{isPlaying ? "Live" : "Ready"}</span>
              </div>
              <div className="flex h-10 items-end gap-1 rounded-lg bg-muted/40 px-2 py-1.5">
                {visualizerBars.map((height, index) => (
                  <span
                    key={index}
                    className="w-full bg-primary transition-[height] duration-75"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            </div>
          )}
        </aside>

        <section className="order-first min-w-0 px-5 py-5 sm:px-8 sm:py-7 lg:order-0">
          <div className="mx-auto max-w-2xl">
            {lyricFile ? (
              <div className="relative overflow-hidden rounded-2xl border border-border bg-card px-5 py-5 sm:px-8 sm:py-7 lg:sticky lg:top-24">
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
                    <div
                      ref={lyricMenuRef}
                      className="relative"
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="More lyric options"
                        aria-expanded={openLyricMenu}
                        onPointerDown={() => setOpenLyricMenu((open) => !open)}
                      >
                        <MoreHorizontal />
                      </Button>
                      {openLyricMenu && (
                        <div className="absolute top-8 right-0 z-10 min-w-40 rounded-lg border border-border bg-background p-1 shadow-lg">
                          <button
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium hover:bg-muted"
                            onClick={() => {
                              setOpenLyricMenu(false)
                              lyricsInputRef.current?.click()
                            }}
                          >
                            <RefreshCw className="size-3.5" />
                            Replace lyrics
                          </button>
                          <div className="my-1 border-t border-border" />
                          <button
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              setOpenLyricMenu(false)
                              removeLyricFile()
                            }}
                          >
                            <Trash2 className="size-3.5" />
                            Remove lyric
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div
                  className="max-h-[40svh] space-y-4 overflow-y-auto pr-2 scrollbar-track-transparent hover:scrollbar-thumb-white/5 lg:max-h-[calc(100vh-25rem)]"
                  style={{ scrollPaddingBlock: "50%" }}
                >
                  {lyrics.map((line, index) => {
                    const isActive = index === activeLyricIndex

                    return (
                    <div
                      key={`${line.timestamp}-${index}`}
                      ref={isActive ? activeLyricRef : undefined}
                      className={`grid grid-cols-[42px_1fr] gap-4 transition-opacity ${isActive ? "opacity-100" : "opacity-35"}`}
                    >
                      <span
                        className={`pt-1 font-mono text-[11px] ${isActive ? "text-primary" : "text-muted-foreground"}`}
                      >
                        {line.time}
                      </span>
                      <p
                        className={`${isActive ? "text-xl font-medium sm:text-2xl" : "text-base"}`}
                      >
                        {line.text}
                      </p>
                    </div>
                    )
                  })}
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
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Play from start"
              title="Play from start"
              disabled={tracks.length === 0}
              onClick={handlePlayFromStart}
            >
              <RotateCcw />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Skip back 5 seconds"
              title="Skip back 5 seconds"
              onClick={() => handleSkip(-5)}
            >
              <SkipBack />
            </Button>
            <Button
              variant="default"
              size="icon-lg"
              aria-label={isPlaying ? "Pause" : "Play"}
              onClick={togglePlay}
            >
              {isPlaying ? <Pause /> : <Play />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Skip forward 5 seconds"
              title="Skip forward 5 seconds"
              onClick={() => handleSkip(5)}
            >
              <SkipForward />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Repeat"
              title="Repeat"
              aria-pressed={repeating}
              className={repeating ? "text-primary" : undefined}
              onClick={() => setRepeating((current) => !current)}
            >
              {repeating ? <Repeat /> : <RepeatOff />}
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] text-muted-foreground">
              {formatTime(currentTime)}
            </span>
            <div className="h-1 flex-1 rounded-full bg-muted">
              <div
                className="h-1 rounded-full bg-primary"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">
              {formatTime(duration)}
            </span>
          </div>
        </div>
      </footer>
    </main>
  )
}
