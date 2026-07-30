# App Store screenshots

Upload-ready screenshots for the App Store listing (submitted with v1.0.0).

| Folder | Slot | Dimensions | Notes |
|--------|------|------------|-------|
| `iphone-6.5/` | iPhone 6.5″ Display | 1284 × 2778 | Captured on the iOS Simulator (iPhone 17 Pro, 1206 × 2622) and resized to the slot size. |
| `ipad-13/` | iPad 13″ Display | 2048 × 2732 | Same source captures, centered on a `#f5ead8` (app background) canvas so the padding is invisible. |

Both sets show the same four screens, in listing order: **Calendar/Heatmap → Garden → Stats → Profile**.

To regenerate from raw simulator captures:

```bash
# iPhone 6.5" (resize to exact slot size)
sips -z 2778 1284 <capture>.png --out iphone-6.5/<name>.png

# iPad 13" (pad onto the app-background canvas)
cp <capture>.png ipad-13/<name>.png
sips -p 2732 2048 --padColor F5EAD8 ipad-13/<name>.png
```
