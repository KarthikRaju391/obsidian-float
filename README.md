## Obsidian Float
This plugin enhances Obsidian reading mode by animating highlighted content as it enters the viewport, so attention stays on important text while scrolling.

## Features

- Supports animated float effects for:
  - Highlights (`==text==` / `<mark>`)
  - Bold (`**text**` / `<strong>`)
  - Italic (`*text*` / `<em>`)
- Per-tag controls:
  - Enable/disable animation per tag type
  - Independent scale amount per tag type
- Global controls:
  - Animation duration
  - Background opacity dimming for non-highlighted content
  - Animate word only (instead of full container block)
  - Animate bold/italic inside highlight blocks
- Scroll performance improvements:
  - Transform-only highlight transition for smoother scrolling
  - Ultra-smooth scrolling behavior that temporarily removes shadow while actively scrolling, then restores it when scrolling stops

## Usage

1. Use Obsidian's built-in highlight syntax to mark text: `==your highlighted text==`
2. (Optional) In plugin settings, enable bold/italic animations and tune scale/duration
3. Switch to **Reading mode** (the plugin does not work in Live Preview or Source mode)
4. Scroll through your note — configured elements animate into focus as they enter the viewport

`Note`: By default, the entire container block (paragraph, list item, heading, etc.) is animated. Enable `Animate word only` in settings to animate just the matched word/inline element.

## Settings Overview

- Global:
  - `Animation duration`
  - `Background opacity`
  - `Animate word only`
  - `Animate bold/italic inside highlights`
- Per tag (Highlights, Bold, Italic):
  - `Enable ... float`
  - `... scale amount`

## Demo


https://user-images.githubusercontent.com/67912316/216141759-29c21316-cd09-4440-8b52-1b701cc8a99d.mp4
