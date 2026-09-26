import { unzip, type Unzipped } from "fflate"

const audioMimeTypes: Record<string, string> = {
  flac: "audio/flac",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  wav: "audio/wav",
}

const supportedAudioExtensions = new Set(Object.keys(audioMimeTypes))

export const isSupportedAudioFile = (file: File | string) => {
  const name = typeof file === "string" ? file : file.name
  const extension = name.split(".").pop()?.toLowerCase()
  return supportedAudioExtensions.has(extension ?? "")
}

const extractAudioFilesFromZip = async (file: File): Promise<File[]> => {
  const archiveData = new Uint8Array(await file.arrayBuffer())
  const entries = await new Promise<Unzipped>((resolve, reject) => {
    unzip(archiveData, (error, unzippedFiles) => {
      if (error) {
        reject(error)
        return
      }

      resolve(unzippedFiles)
    })
  })

  return Object.entries(entries).flatMap(([path, contents]) => {
    const name = path.split(/[\\/]/).pop()
    if (!name || !isSupportedAudioFile(name)) return []

    const extension = name.split(".").pop()?.toLowerCase() ?? ""
    return [new File([contents], name, { type: audioMimeTypes[extension] })]
  })
}

export const prepareAudioFiles = async (files: File[]) => {
  const audioFiles: File[] = []

  for (const file of files) {
    if (isSupportedAudioFile(file)) {
      audioFiles.push(file)
    } else if (file.name.toLowerCase().endsWith(".zip")) {
      audioFiles.push(...(await extractAudioFilesFromZip(file)))
    }
  }

  return audioFiles
}