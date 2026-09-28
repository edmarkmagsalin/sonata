import { strToU8, unzipSync, zipSync, type Zippable } from "fflate"

import type { Track } from "./store"

export interface SessionSnapshot {
  tracks: Track[]
  currentTime: number
  masterVolume: number
  repeating: boolean
  lyricFile: File | null
  lyricContent: string | null
}

export interface SavedSessionSummary {
  id: string
  name: string
  updatedAt: number
}

interface StoredTrack extends Omit<Track, "file"> {
  assetKey: string
  fileName: string
  fileType: string
  lastModified: number
}

interface StoredSession extends SavedSessionSummary {
  currentTime: number
  masterVolume: number
  repeating: boolean
  tracks: StoredTrack[]
  lyricFileName: string | null
  lyricContent: string | null
}

interface StoredAsset {
  key: string
  fileName: string
  fileType: string
  lastModified: number
  blob: Blob
}

interface SessionBundleTrack {
  name: string
  fileName: string
  fileType: string
  muted: boolean
  soloed: boolean
  volume: number
}

interface SessionBundleManifest {
  version: 1
  name: string
  currentTime: number
  masterVolume: number
  repeating: boolean
  lyricFileName: string | null
  lyricContent: string | null
  tracks: SessionBundleTrack[]
}

const databaseName = "sonata-sessions"
const databaseVersion = 1
const sessionsStoreName = "sessions"
const assetsStoreName = "assets"

const openDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser."))
      return
    }

    const request = indexedDB.open(databaseName, databaseVersion)

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(sessionsStoreName)) {
        database.createObjectStore(sessionsStoreName, { keyPath: "id" })
      }
      if (!database.objectStoreNames.contains(assetsStoreName)) {
        database.createObjectStore(assetsStoreName, { keyPath: "key" })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error("Unable to open browser storage."))
  })

const transactionDone = (transaction: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () =>
      reject(
        transaction.error ?? new Error("Browser storage transaction aborted.")
      )
    transaction.onerror = () =>
      reject(
        transaction.error ?? new Error("Browser storage transaction failed.")
      )
  })

const requestResult = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error("Browser storage request failed."))
  })

const toSnapshot = async (record: StoredSession): Promise<SessionSnapshot> => {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(assetsStoreName, "readonly")
    const done = transactionDone(transaction)
    const assetRequests = record.tracks.map((track) =>
      requestResult<StoredAsset | undefined>(
        transaction.objectStore(assetsStoreName).get(track.assetKey)
      )
    )
    const assets = await Promise.all(assetRequests)
    await done

    const tracks = record.tracks.map((track, index) => {
      const asset = assets[index]
      if (!asset) throw new Error(`Missing audio data for ${track.fileName}.`)

      return {
        id: `${Date.now()}-${index}-${Math.random().toString(36).substring(2, 7)}`,
        name: track.name,
        file: new File([asset.blob], asset.fileName, {
          type: asset.fileType,
          lastModified: asset.lastModified,
        }),
        muted: track.muted,
        soloed: track.soloed,
        volume: track.volume,
      }
    })

    return {
      tracks,
      currentTime: record.currentTime,
      masterVolume: record.masterVolume,
      repeating: record.repeating,
      lyricFile:
        record.lyricFileName && record.lyricContent !== null
          ? new File([record.lyricContent], record.lyricFileName, {
              type: "text/plain",
            })
          : null,
      lyricContent: record.lyricContent,
    }
  } finally {
    database.close()
  }
}

export const listSavedSessions = async (): Promise<SavedSessionSummary[]> => {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(sessionsStoreName, "readonly")
    const done = transactionDone(transaction)
    const records = await requestResult<StoredSession[]>(
      transaction.objectStore(sessionsStoreName).getAll()
    )
    await done
    return records
      .map(({ id, name, updatedAt }) => ({ id, name, updatedAt }))
      .sort((left, right) => right.updatedAt - left.updatedAt)
  } finally {
    database.close()
  }
}

export const saveSession = async (
  name: string,
  snapshot: SessionSnapshot
): Promise<SavedSessionSummary> => {
  const database = await openDatabase()
  const id = crypto.randomUUID()
  const updatedAt = Date.now()
  const tracks: StoredTrack[] = snapshot.tracks.map((track, index) => ({
    id: track.id,
    name: track.name,
    muted: track.muted,
    soloed: track.soloed,
    volume: track.volume,
    assetKey: `${id}:${index}`,
    fileName: track.file.name,
    fileType: track.file.type,
    lastModified: track.file.lastModified,
  }))
  const record: StoredSession = {
    id,
    name,
    updatedAt,
    currentTime: snapshot.currentTime,
    masterVolume: snapshot.masterVolume,
    repeating: snapshot.repeating,
    tracks,
    lyricFileName: snapshot.lyricFile?.name ?? null,
    lyricContent: snapshot.lyricContent,
  }

  try {
    const transaction = database.transaction(
      [sessionsStoreName, assetsStoreName],
      "readwrite"
    )
    const done = transactionDone(transaction)
    const assetStore = transaction.objectStore(assetsStoreName)
    snapshot.tracks.forEach((track, index) => {
      assetStore.put({
        key: `${id}:${index}`,
        fileName: track.file.name,
        fileType: track.file.type,
        lastModified: track.file.lastModified,
        blob: track.file,
      } satisfies StoredAsset)
    })
    transaction.objectStore(sessionsStoreName).put(record)
    await done
    return { id, name, updatedAt }
  } finally {
    database.close()
  }
}

export const loadSavedSession = async (id: string) => {
  const database = await openDatabase()
  let record: StoredSession | undefined
  try {
    const transaction = database.transaction(sessionsStoreName, "readonly")
    const done = transactionDone(transaction)
    record = await requestResult<StoredSession | undefined>(
      transaction.objectStore(sessionsStoreName).get(id)
    )
    await done
  } finally {
    database.close()
  }

  if (!record) throw new Error("That saved session could not be found.")
  return { name: record.name, snapshot: await toSnapshot(record) }
}

export const deleteSavedSession = async (id: string) => {
  const database = await openDatabase()
  try {
    const readTransaction = database.transaction(sessionsStoreName, "readonly")
    const readDone = transactionDone(readTransaction)
    const record = await requestResult<StoredSession | undefined>(
      readTransaction.objectStore(sessionsStoreName).get(id)
    )
    await readDone
    if (!record) return

    const transaction = database.transaction(
      [sessionsStoreName, assetsStoreName],
      "readwrite"
    )
    const done = transactionDone(transaction)
    transaction.objectStore(sessionsStoreName).delete(id)
    const assetStore = transaction.objectStore(assetsStoreName)
    record.tracks.forEach((track) => assetStore.delete(track.assetKey))
    await done
  } finally {
    database.close()
  }
}

export const exportSessionBundle = async (
  name: string,
  snapshot: SessionSnapshot
) => {
  const manifest: SessionBundleManifest = {
    version: 1,
    name,
    currentTime: snapshot.currentTime,
    masterVolume: snapshot.masterVolume,
    repeating: snapshot.repeating,
    lyricFileName: snapshot.lyricFile?.name ?? null,
    lyricContent: snapshot.lyricContent,
    tracks: snapshot.tracks.map((track) => ({
      name: track.name,
      fileName: track.file.name,
      fileType: track.file.type,
      muted: track.muted,
      soloed: track.soloed,
      volume: track.volume,
    })),
  }
  const files: Zippable = {
    "manifest.json": strToU8(JSON.stringify(manifest)),
  }

  for (const [index, track] of snapshot.tracks.entries()) {
    files[`tracks/${index}`] = new Uint8Array(await track.file.arrayBuffer())
  }

  return new Blob([zipSync(files, { level: 0 })], {
    type: "application/zip",
  })
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value)

export const importSessionBundle = async (file: File) => {
  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()))
  const manifestBytes = entries["manifest.json"]
  if (!manifestBytes) throw new Error("This file is not a Sonata session.")

  let value: unknown
  try {
    value = JSON.parse(new TextDecoder().decode(manifestBytes))
  } catch {
    throw new Error("The session manifest is invalid.")
  }

  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.name !== "string" ||
    !isFiniteNumber(value.currentTime) ||
    value.currentTime < 0 ||
    !isFiniteNumber(value.masterVolume) ||
    value.masterVolume < 0 ||
    value.masterVolume > 1 ||
    typeof value.repeating !== "boolean" ||
    !Array.isArray(value.tracks) ||
    value.tracks.length > 5 ||
    (value.lyricFileName !== null && typeof value.lyricFileName !== "string") ||
    (value.lyricContent !== null && typeof value.lyricContent !== "string")
  ) {
    throw new Error("The session manifest has unsupported or invalid data.")
  }

  const tracks: Track[] = value.tracks.map((track, index) => {
    const asset = entries[`tracks/${index}`]
    if (
      !isRecord(track) ||
      !asset ||
      typeof track.name !== "string" ||
      typeof track.fileName !== "string" ||
      typeof track.fileType !== "string" ||
      typeof track.muted !== "boolean" ||
      typeof track.soloed !== "boolean" ||
      !isFiniteNumber(track.volume) ||
      track.volume < 0 ||
      track.volume > 1
    ) {
      throw new Error("The session contains an invalid audio track.")
    }

    return {
      id: `${Date.now()}-${index}-${Math.random().toString(36).substring(2, 7)}`,
      name: track.name,
      file: new File([asset], track.fileName, { type: track.fileType }),
      muted: track.muted,
      soloed: track.soloed,
      volume: track.volume,
    }
  })

  if (value.lyricFileName !== null && typeof value.lyricFileName !== "string") {
    throw new Error("The session contains an invalid lyric file name.")
  }

  const lyricContent = value.lyricContent as string | null
  const lyricFileName = value.lyricFileName as string | null

  return {
    name: value.name,
    snapshot: {
      tracks,
      currentTime: value.currentTime,
      masterVolume: value.masterVolume,
      repeating: value.repeating,
      lyricFile:
        lyricFileName !== null && lyricContent !== null
          ? new File([lyricContent], lyricFileName, { type: "text/plain" })
          : null,
      lyricContent,
    } satisfies SessionSnapshot,
  }
}
