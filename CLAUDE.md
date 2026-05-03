{\rtf1\ansi\ansicpg1252\cocoartf2821
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\froman\fcharset0 Times-Roman;\f1\froman\fcharset0 Times-Bold;\f2\fnil\fcharset0 HelveticaNeue;
}
{\colortbl;\red255\green255\blue255;\red0\green0\blue0;\red201\green206\blue214;\red238\green99\blue114;
\red229\green232\blue236;\red0\green0\blue0;\red17\green0\blue231;}
{\*\expandedcolortbl;;\cssrgb\c0\c0\c0;\cssrgb\c82854\c84426\c87068;\cssrgb\c95614\c48128\c51935;
\cssrgb\c91876\c92662\c94116;\cssrgb\c0\c0\c0\c84706;\cssrgb\c9689\c9755\c92705;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\deftab720
\pard\pardeftab720\partightenfactor0

\f0\fs24 \cf2 \expnd0\expndtw0\kerning0
\outl0\strokewidth0 \strokec2 markdown\
\pard\pardeftab720\partightenfactor0

\f1\b \cf2 \strokec3 #\strokec4  Project Overview
\f0\b0 \strokec5 \
\
A personal birthday project documenting 54 weeks of the past year through \
photos and real conversations. One photo per week, each paired with a \
subtitle \'97 an actual conversation, something overheard, something said that \
stuck. The project lives entirely in the browser with four distinct ways to \
experience the same 54 photos.\
\
\pard\pardeftab720\partightenfactor0
\cf2 \strokec3 ---\strokec5 \
\
\pard\pardeftab720\partightenfactor0

\f1\b \cf2 \strokec3 #\strokec4  Tech Stack
\f0\b0 \strokec5 \
\
\pard\pardeftab720\partightenfactor0
\cf2 \strokec3 -\strokec5  \strokec3 **\strokec5 Vanilla JS\strokec3 **\strokec5  \'97 no frameworks\
\strokec3 -\strokec5  \strokec3 **\strokec5 Cloudinary\strokec3 **\strokec5  \'97 image hosting and delivery\
\strokec3 -\strokec5  \strokec3 **\strokec5 data.json\strokec3 **\strokec5  \'97 single source of truth for all photo metadata\
\strokec3 -\strokec5  \strokec3 **\strokec5 Three.js\strokec3 **\strokec5  \'97 3D globe view\
\strokec3 -\strokec5  \strokec3 **\strokec5 CSS custom properties\strokec3 **\strokec5  \'97 theming (dark/light)\
\
No backend. No database. No build step unless absolutely necessary.\
\
\strokec3 ---\strokec5 \
\
\pard\pardeftab720\partightenfactor0

\f1\b \cf2 \strokec3 #\strokec4  Project Structure
\f0\b0 \strokec5 \
\pard\pardeftab720\sa240\partightenfactor0
\cf2 \strokec2 project/ \uc0\u9500 \u9472 \u9472  index.html \u9500 \u9472 \u9472  style.css \u9500 \u9472 \u9472  main.js \u9500 \u9472 \u9472  data.json \u9500 \u9472 \u9472  views/ \u9474  \u9500 \u9472 \u9472  horizontal.js \u9474  \u9500 \u9472 \u9472  vertical.js \u9474  \u9500 \u9472 \u9472  freeform.js \u9474  \u9492 \u9472 \u9472  globe.js \u9500 \u9472 \u9472  components/ \u9474  \u9500 \u9472 \u9472  modal.js \u9474  \u9500 \u9472 \u9472  nav.js \u9474  \u9492 \u9472 \u9472  theme-toggle.js \u9492 \u9472 \u9472  assets/ \u9492 \u9472 \u9472  fonts/\
\pard\pardeftab720\qc\partightenfactor0

\f2\fs22 \cf2 \strokec6 \
\pard\pardeftab720\partightenfactor0

\f0\fs24 \cf2 \strokec5 \
---\
\
# Data Structure\
\
`data.json` is the only data source. Every piece of content comes from here.\
\
```json\
[\
  \{\
    "id": "week-01",\
    "week": 1,\
    "cloudinary_url": "https://res.cloudinary.com/yourcloud/image/upload/week-01.webp",\
    "subtitle": "She guessed my favourite colour on the first try. But between \
                 me and you, I didn't have a favourite colour until she yelled \
                 out Yellow",\
    "context": "Lagos, August",\
    "category": "yellow",\
    "is_anchor": false,\
    "allow_download": true,\
    "location": \{\
      "lat": 6.5244,\
      "lng": 3.3792\
    \}\
  \}\
]\
```\
\
Photos are ordered chronologically by `week` field (1\'9654) across all views.\
\
---\
\
# Views\
\
## Shared Behaviour Across All Views\
\
- All 4 views display the same 54 photos\
- Photos always render in chronological order (week 1 \uc0\u8594  54)\
- A persistent nav bar lets the user switch between views at any time\
- A theme toggle switches between dark and light mode globally\
- Clicking a photo in horizontal, vertical, or freeform view opens a modal\
- Every photo has a download button\
\
## View Switcher Nav\
\
Persistent. Always visible. Four options:\
\pard\pardeftab720\sa240\partightenfactor0
\cf2 \strokec2 [ Horizontal ] [ Vertical ] [ Canvas ] [ Globe ]\
\pard\pardeftab720\qc\partightenfactor0

\f2\fs22 \cf2 \strokec6 \
\pard\pardeftab720\partightenfactor0

\f0\fs24 \cf2 \strokec5 \
Switching views should feel instant \'97 no full page reload. Use JS to \
show/hide view containers and initialise lazily.\
\
---\
\
## 1. Horizontal View\
\
A horizontally scrolling strip of photos.\
\
- Scroll left/right to move through all 54 photos\
- Photos are equal height, variable width based on original aspect ratio\
- Smooth momentum scrolling\
- Keyboard support: arrow keys scroll left/right\
- On mobile: touch/swipe scrolls naturally\
\
---\
\
## 2. Vertical View\
\
A vertically scrolling feed.\
\
- Standard vertical scroll\
- Photos stack top to bottom chronologically\
- Each photo takes roughly 80\'9690% of viewport width, centred\
- Subtitle visible beneath each photo at all times (not hidden until click)\
- Context text (smaller, muted) below subtitle\
\
---\
\
## 3. Freeform Canvas View\
\
An infinite canvas where photos are scattered spatially.\
\
- Photos are positioned on a large canvas (e.g. 4000x4000px virtual space)\
- Pan by clicking and dragging\
- Pinch or scroll to zoom in/out\
- Photos are not randomly placed \'97 position them with intentional spacing \
  so nothing overlaps and the canvas feels curated, not chaotic\
- Anchor photos (`is_anchor: true`) should be slightly larger than the rest\
- Subtle connecting lines or no lines \'97 keep it clean\
\
---\
\
## 4. Globe View (Three.js)\
\
### Setup\
\
- Render a 3D globe made entirely of the 54 photos as textured planes\
- Distribute photos evenly using the **Fibonacci sphere algorithm** so the \
  globe feels balanced and immersive from every angle\
- Each image plane faces outward (billboarded away from globe center)\
- Globe should feel like it's wrapped in visual content\
\
### Cinematic Entry\
\
When the page loads into globe view:\
- Camera starts far back (as if approaching from space)\
- Smoothly flies toward the globe and eases to a stop just outside it\
- Entry should feel cinematic \'97 slow, deliberate, weightless\
\
### Core Interaction\
\
- **Drag** to rotate the globe with smooth inertia (momentum after release)\
- **Scroll** to move between outside and inside the globe (zoom in/out)\
- Full 360\'b0 exploration from any angle\
\
### Focus Mode (Vision Pro Style)\
\
This is the most important interaction in the entire project.\
\
When a user clicks an image on the globe:\
\
1. The image **detaches** from the globe\
2. It moves directly into the user's field of view\
3. It centres in front of the camera at a comfortable depth\
4. It scales up to feel like a **floating spatial card** \'97 not just a \
   zoomed image\
5. The rest of the globe **fades into the background** (dim, blurred, \
   less prominent)\
\
**While in focus mode:**\
- Selected image is locked in front of the camera\
- Subtle **parallax/tilt** based on mouse movement for depth illusion\
- Soft **glow + frame** around the image (Vision Pro aesthetic)\
- Subtitle and context text appear below the floating card\
- Download button visible\
\
**Navigation in focus mode:**\
- Left/right arrow keys or swipe to move between photos smoothly\
- Transition between images like sliding spatial cards\
- **ESC** or click outside to exit focus mode\
\
**Exiting focus mode:**\
- Image animates back to its original position on the globe\
- Globe returns to full brightness\
- Camera resumes normal globe interaction\
\
---\
\
# Modal (Horizontal, Vertical, Freeform Views)\
\
Triggered by clicking any photo in the non-globe views.\
\
**Contents:**\
- Full size photo\
- Subtitle (full conversation, preserve line breaks and em dashes for \
  dialogue format)\
- Context text (location, time, or note \'97 can be null, hide if empty)\
- Download button\
- Close button (X) and click outside to close\
- Left/right arrows to navigate to previous/next photo without closing modal\
\
**Behaviour:**\
- Opens with a smooth fade/scale in\
- Background content is dimmed\
- Keyboard: ESC closes, arrow keys navigate\
\
---\
\
# Subtitle Formatting\
\
Subtitles come in two formats. Render them differently.\
\
**Single voice** \'97 render as a paragraph:\
\pard\pardeftab720\sa240\partightenfactor0
\cf2 \strokec2 Since when has it been cringe to try. Everyone's scared of being cringe now. Lowkey I think we all just need to be willing to be cringe sometimes\
\pard\pardeftab720\qc\partightenfactor0

\f2\fs22 \cf2 \strokec6 \
\pard\pardeftab720\partightenfactor0

\f0\fs24 \cf2 \strokec5 \
**Dialogue** \'97 detect by presence of em dash (\'97) and render as conversation:\
\pard\pardeftab720\sa240\partightenfactor0
\cf2 \strokec2 \'97 "Bro gay son or thot daughter" \'97 "Wait dumbass isn't it gay thoughts\'97" \'97 "Bro what are you even saying" \'97 "I genuinely don't know anymore"\
\pard\pardeftab720\qc\partightenfactor0

\f2\fs22 \cf2 \strokec6 \
\pard\pardeftab720\partightenfactor0

\f0\fs24 \cf2 \strokec5 \
Each dialogue line on its own row. Slightly different styling to the \
single voice format \'97 tighter line height, monospace or distinct font.\
\
---\
\
# Download\
\
Every photo is downloadable.\
\
- Download button visible in modal and in globe focus mode\
- Fetch the Cloudinary URL and trigger a browser download\
- Filename should be: `week-\{number\}.jpg` (e.g. `week-01.jpg`)\
- Do not open in a new tab \'97 force download\
\
```js\
async function downloadPhoto(url, filename) \{\
  const response = await fetch(url)\
  const blob = await response.blob()\
  const a = document.createElement('a')\
  a.href = URL.createObjectURL(blob)\
  a.download = filename\
  a.click()\
\}\
```\
\
---\
\
# Theming\
\
Dark and light mode. Toggle persists in localStorage.\
\
**Dark mode:**\
- Background: `#0a0a0a`\
- Text: `#f0f0f0`\
- Muted text: `#666`\
- Accent: `#ffffff`\
\
**Light mode:**\
- Background: `#f5f5f5`\
- Text: `#0a0a0a`\
- Muted text: `#999`\
- Accent: `#000000`\
\
Use CSS custom properties exclusively. Never hardcode colours in JS.\
\
```css\
:root[data-theme="dark"] \{\
  --bg: #0a0a0a;\
  --text: #f0f0f0;\
  --muted: #666;\
  --accent: #ffffff;\
\}\
\
:root[data-theme="light"] \{\
  --bg: #f5f5f5;\
  --text: #0a0a0a;\
  --muted: #999;\
  --accent: #000000;\
\}\
```\
\
Default to dark on first load.\
\
---\
\
# Figma\
\
The visual design lives in Figma. Before writing any CSS or layout code, \
use the Figma MCP to:\
\
1. Pull the exact colour values, typography, spacing tokens\
2. Check component designs for the modal, nav, and view switcher\
3. Reference the globe focus mode visual treatment\
4. Pull any specific animation easing curves specified in the design\
\
Do not guess at design values. Always check Figma first.\
\
---\
\
# Performance Rules\
\
- Never load all 54 images at once\
- Use **Intersection Observer** to lazy load images as they enter the viewport\
- In the globe view, load textures progressively \'97 low resolution first, \
  full resolution on focus\
- Cloudinary handles compression and format automatically \'97 use their \
  URL parameters for responsive sizing:\
  - Thumbnail: `w_400,q_auto,f_auto`\
  - Modal/focus: `w_1200,q_auto,f_auto`\
  - Download: original URL, no transformations\
\
---\
\
# Cloudinary URL Pattern\
\pard\pardeftab720\sa240\partightenfactor0
{\field{\*\fldinst{HYPERLINK "https://res.cloudinary.com/%7Bcloud_name%7D/image/upload/%7Btransformations%7D/%7Bpublic_id%7D"}}{\fldrslt \cf2 \ul \ulc2 \strokec7 https://res.cloudinary.com/\{cloud_name\}/image/upload/\{transformations\}/\{public_id\}}}\strokec2 \
\pard\pardeftab720\qc\partightenfactor0

\f2\fs22 \cf2 \strokec6 \
\pard\pardeftab720\partightenfactor0

\f0\fs24 \cf2 \strokec5 \
Build a helper:\
\
```js\
function cloudinaryUrl(baseUrl, width, quality = 'auto') \{\
  return baseUrl.replace(\
    '/upload/',\
    `/upload/w_$\{width\},q_$\{quality\},f_auto/`\
  )\
\}\
```\
\
---\
\
# What Not To Do\
\
- No frameworks \'97 vanilla JS only\
- No CSS-in-JS\
- No unnecessary dependencies \'97 Three.js for the globe, nothing else \
  that isn't absolutely required\
- Do not hardcode photo data \'97 everything comes from `data.json`\
- Do not use `alert()` or `confirm()` for anything\
- Do not add features not listed in this document without asking first\
}