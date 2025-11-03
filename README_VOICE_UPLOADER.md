# DZMM Voice File Uploader

A userscript that adds custom audio file upload capability to DZMM.ai chat, allowing you to upload pre-recorded audio files instead of only recording from the microphone.

## Features

- ✅ Upload custom audio files (m4a, mp3, ogg, wav, webm)
- ✅ Automatic audio duration detection
- ✅ File size validation (max 50MB)
- ✅ Seamless integration with DZMM UI
- ✅ Support for all DZMM domains (dzmm.ai, dzmm.io, laopo.ai, etc.)
- ✅ SPA navigation support (auto-reinject on route changes)

## Supported Audio Formats

The script accepts the following audio formats (in priority order):
1. **audio/mp4** (`.m4a`) - Recommended
2. **audio/x-m4a**
3. **audio/mpeg** (`.mp3`)
4. **audio/webm;codecs=opus**
5. **audio/webm**
6. **audio/ogg**
7. **audio/wav**

## Installation

### Option 1: Userscript Manager (Recommended)

1. Install a userscript manager:
   - **Firefox**: [Tampermonkey](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/) or [Greasemonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/)
   - **Chrome/Edge**: [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - **Safari**: [Userscripts](https://apps.apple.com/us/app/userscripts/id1463298887)

2. Click to install: [dzmm-voice-uploader.user.js](./dzmm-voice-uploader.user.js)

3. The script will automatically activate when you visit DZMM.ai

### Option 2: Browser Console (Quick Test)

For quick testing without installing a userscript manager:

1. Open DZMM.ai chat page
2. Open browser developer console (F12)
3. Copy and paste the entire content of `dzmm-voice-uploader.user.js` (excluding the UserScript header)
4. Press Enter

**Note**: This method requires re-pasting the script on every page load.

### Option 3: Bookmarklet (Portable)

1. Create a new bookmark in your browser
2. Set the name to "DZMM Voice Uploader"
3. Set the URL to the following (minified version):

```javascript
javascript:(function(){/* Bookmarklet code - see bookmarklet.js */})();
```

4. Click the bookmark when on DZMM.ai chat page

## Usage

Once installed, you'll see a new **upload button** (↑ icon) next to the microphone button in the chat input area.

### Basic Workflow

1. **Click the upload button** (↑ icon) next to the microphone
2. **Select your audio file** from the file picker dialog
3. **Wait for upload** - The script will:
   - Validate the file type and size
   - Calculate audio duration automatically
   - Upload to DZMM API
   - Show success notification
4. **Send the message** - The uploaded voice will be ready to send

### Supported Actions

- **Upload any audio file**: Click the upload button and select a file
- **File validation**: Automatically checks format and size
- **Duration detection**: Uses Web Audio API to detect duration
- **Error handling**: Clear error messages for failed uploads

## Technical Details

### API Endpoint

The script uploads voice files to:
```
POST /api/chat/voice-messages
```

### Request Format

```javascript
FormData:
  - file: Blob (audio file)
  - duration: String (duration in seconds)
```

### Response Format

```javascript
{
  voiceId: String?,           // Optional voice ID
  url: String,                // CDN URL for playback
  path: String,               // Storage path
  duration: Number,           // Duration in seconds
  transcript: String?,        // Optional transcription
  fileType: String,          // e.g., "m4a", "mp3"
  fileSize: Number           // File size in bytes
}
```

### Audio Duration Detection

The script uses the HTML5 Audio API to automatically detect duration:

```javascript
async function getAudioDuration(file) {
    const audio = new Audio();
    const url = URL.createObjectURL(file);

    return new Promise((resolve, reject) => {
        audio.addEventListener('loadedmetadata', () => {
            URL.revokeObjectURL(url);
            resolve(audio.duration);
        });
        audio.src = url;
    });
}
```

## Limitations

1. **File Size**: Maximum 50MB (configurable in script)
2. **Audio Formats**: Only standard web audio formats supported
3. **Duration**: Must be a valid audio file with metadata
4. **Authentication**: Requires valid DZMM authentication cookies
5. **UI Integration**: Button injection depends on DZMM UI structure

## Troubleshooting

### Upload button not appearing

1. **Refresh the page** - The button should appear within ~2 seconds
2. **Check console** - Look for messages starting with `🎤`
3. **Verify script is active** - You should see "DZMM Voice Uploader Active" in console
4. **Check DZMM UI** - Make sure the voice recording button exists

### Upload fails

1. **Check file format** - Ensure it's a supported audio format
2. **Check file size** - Must be under 50MB
3. **Check authentication** - Ensure you're logged into DZMM
4. **Check network** - Open Network tab in DevTools
5. **Check API response** - Look for errors in `/api/chat/voice-messages` request

### Duration detection fails

1. **Verify audio file** - Play it in a media player first
2. **Check codec** - Some codecs may not be supported by browsers
3. **Try different format** - Convert to m4a or mp3
4. **Check console** - Look for error messages

## Development

### Enable Debug Mode

Edit the script and set:
```javascript
const DEBUG = true;
```

This will log detailed information to the console:
- File selection events
- Upload progress
- API responses
- Button injection attempts

### File Structure

```
dzmm_patch/
├── dzmm-voice-uploader.user.js    # Main userscript
├── README_VOICE_UPLOADER.md       # This file
└── dzmm-time-travel.user.js       # Related script
```

## Compatibility

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ All DZMM domains (dzmm.ai, dzmm.io, laopo.ai, etc.)
- ✅ Desktop and mobile browsers (with limitations)

## Privacy & Security

- **No data collection**: The script only interacts with DZMM's API
- **Local processing**: Audio duration is calculated locally
- **No external requests**: Only uploads to DZMM servers
- **Cookie-based auth**: Uses your existing DZMM session

## Credits

- **Author**: kuma
- **Inspired by**: DZMM Time Travel script
- **API Analysis**: Based on DZMM.ai reverse engineering

## License

MIT License - Feel free to modify and distribute

## Related Scripts

- **DZMM Time Travel**: Message backtracking with timestamp control
- **DZMM Spider**: Message archival and monitoring system

## Changelog

### v1.1.0 (2025-11-03)
- **FIXED**: Automatically sends voice message after upload (no manual send required)
- Uses React internals to trigger `onVoiceReady` callback
- Improved success/failure notifications
- Better error handling with fallback mechanisms

### v1.0.0 (2025-11-03)
- Initial release
- Basic file upload functionality
- Auto duration detection
- File validation
- SPA navigation support
- Error handling and notifications
