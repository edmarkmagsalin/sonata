# Sonata

Sonata is a browser-based audio player and mixer for synchronizing multiple sound files with lyrics. Load up to five local audio tracks and one lyrics file, then play them together while viewing the lyrics in sync. Live [demo](https://sonata-9xm3.onrender.com/).

## Features

- Load WAV, MP3, and M4A audio files
- Load and display lyrics from an LRC or TXT file
- Play, pause, seek, and repeat tracks
- Mute or solo individual tracks
- Switch between light and dark themes

The current version limits audio uploads to five tracks and one LRC or TXT file. Individual track volume controls and audio combining/export are planned for a future pro version.

## Run locally

### Requirements

- Node.js 20 or newer
- pnpm 10.33.4 or compatible

Install dependencies from the repository root:

```bash
pnpm install
```

Start the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Useful checks from the repository root:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

## Project structure

- `apps/web` contains the Sonata Next.js application.
- `packages/ui` contains shared UI components and styles.

## shadcn/ui

This is a Next.js monorepo template with shadcn/ui.

## Adding components

To add components to the web app, run the following command from the repository root:

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

This will place the ui components in the `packages/ui/src/components` directory.

## Using components

To use the components in your app, import them from the `ui` package.

```tsx
import { Button } from "@workspace/ui/components/button"
```
