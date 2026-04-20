import { useId, useState } from 'react'

const objectLayouts = {
  bed: { x: 72, y: 260, w: 170, h: 62 },
  door: { x: 410, y: 118, w: 72, h: 190 },
  window: { x: 260, y: 70, w: 118, h: 88 },
  cat: { x: 292, y: 278, w: 42, h: 26 },
  phone: { x: 176, y: 238, w: 34, h: 20 },
  stall: { x: 58, y: 132, w: 172, h: 146 },
  scale: { x: 120, y: 186, w: 46, h: 50 },
  fruit: { x: 250, y: 252, w: 92, h: 52 },
  bike: { x: 360, y: 244, w: 120, h: 66 },
  dog: { x: 428, y: 306, w: 56, h: 30 },
  train: { x: 52, y: 134, w: 285, h: 112 },
  clock: { x: 405, y: 54, w: 48, h: 48 },
  luggage: { x: 358, y: 258, w: 74, h: 60 },
  tickets: { x: 240, y: 278, w: 38, h: 24 },
  pigeons: { x: 54, y: 76, w: 82, h: 36 },
  stove: { x: 62, y: 212, w: 132, h: 96 },
  table: { x: 254, y: 234, w: 172, h: 74 },
  milk: { x: 326, y: 208, w: 38, h: 56 },
  pancakes: { x: 102, y: 194, w: 70, h: 22 },
  paintings: { x: 66, y: 74, w: 260, h: 92 },
  statue: { x: 374, y: 154, w: 82, h: 146 },
  alarm: { x: 420, y: 72, w: 54, h: 42 },
  radio: { x: 246, y: 224, w: 42, h: 28 },
  sketchbook: { x: 78, y: 258, w: 76, h: 48 },
  tower: { x: 48, y: 134, w: 88, h: 162 },
  kite: { x: 330, y: 54, w: 92, h: 82 },
  sandcastle: { x: 202, y: 252, w: 118, h: 72 },
  hat: { x: 414, y: 246, w: 62, h: 34 },
  clouds: { x: 168, y: 52, w: 156, h: 56 },
  desks: { x: 70, y: 232, w: 132, h: 74 },
  screen: { x: 242, y: 98, w: 154, h: 98 },
  coffee: { x: 394, y: 238, w: 42, h: 62 },
  laptop: { x: 250, y: 254, w: 92, h: 48 },
  lights: { x: 80, y: 54, w: 332, h: 22 },
  fire: { x: 236, y: 240, w: 92, h: 86 },
  tent: { x: 56, y: 170, w: 142, h: 118 },
  cooler: { x: 382, y: 262, w: 80, h: 46 },
  owl: { x: 384, y: 88, w: 54, h: 70 },
  logs: { x: 230, y: 310, w: 112, h: 22 },
  cart: { x: 78, y: 220, w: 116, h: 84 },
  chart: { x: 288, y: 108, w: 64, h: 86 },
  flowers: { x: 380, y: 238, w: 82, h: 70 },
  doors: { x: 64, y: 82, w: 138, h: 142 },
  wheelchair: { x: 250, y: 254, w: 100, h: 64 },
  beakers: { x: 82, y: 210, w: 132, h: 92 },
  board: { x: 270, y: 70, w: 180, h: 100 },
  foam: { x: 166, y: 154, w: 122, h: 74 },
  gate: { x: 294, y: 74, w: 150, h: 62 },
  passports: { x: 126, y: 228, w: 62, h: 42 },
  suitcases: { x: 318, y: 248, w: 108, h: 70 },
  pilot: { x: 428, y: 152, w: 46, h: 118 },
  line: { x: 54, y: 190, w: 176, h: 118 },
  horse: { x: 302, y: 176, w: 142, h: 86 },
  bucket: { x: 250, y: 254, w: 56, h: 56 },
  eggs: { x: 94, y: 240, w: 74, h: 46 },
  rain: { x: 72, y: 54, w: 330, h: 96 },
  soup: { x: 116, y: 214, w: 68, h: 36 },
  ring: { x: 292, y: 218, w: 44, h: 36 },
  glass: { x: 382, y: 242, w: 52, h: 64 },
  violin: { x: 72, y: 112, w: 82, h: 104 },
  shelves: { x: 58, y: 74, w: 150, h: 200 },
  books: { x: 72, y: 94, w: 124, h: 96 },
  papers: { x: 268, y: 166, w: 132, h: 94 },
  desk: { x: 292, y: 246, w: 142, h: 62 },
  band: { x: 72, y: 150, w: 148, h: 126 },
  flags: { x: 280, y: 86, w: 122, h: 98 },
  balloon: { x: 398, y: 56, w: 58, h: 100 },
  confetti: { x: 70, y: 56, w: 350, h: 86 },
  camera: { x: 308, y: 244, w: 92, h: 58 },
  car: { x: 68, y: 188, w: 214, h: 90 },
  engine: { x: 160, y: 166, w: 102, h: 72 },
  oil: { x: 252, y: 264, w: 86, h: 34 },
  tire: { x: 378, y: 244, w: 68, h: 68 },
  bus: { x: 52, y: 132, w: 246, h: 122 },
  umbrella: { x: 348, y: 112, w: 94, h: 132 },
  snow: { x: 62, y: 54, w: 360, h: 92 },
  headlights: { x: 228, y: 198, w: 48, h: 28 },
  bench: { x: 326, y: 264, w: 130, h: 46 },
  cake: { x: 220, y: 220, w: 92, h: 60 },
  plants: { x: 68, y: 190, w: 104, h: 112 },
  tablecloth: { x: 190, y: 252, w: 174, h: 56 },
  candles: { x: 240, y: 174, w: 62, h: 48 },
  bubbles: { x: 362, y: 120, w: 96, h: 96 },
  sword: { x: 338, y: 238, w: 112, h: 56 },
  'rain machine': { x: 70, y: 88, w: 112, h: 100 },
  script: { x: 210, y: 230, w: 74, h: 54 },
  trail: { x: 70, y: 230, w: 340, h: 96 },
  map: { x: 198, y: 150, w: 70, h: 58 },
  fog: { x: 98, y: 72, w: 288, h: 72 },
  backpack: { x: 320, y: 236, w: 78, h: 74 },
  goat: { x: 394, y: 188, w: 82, h: 72 },
}

const atmosphereObjects = new Set(['clouds', 'rain', 'snow', 'confetti', 'fog', 'papers', 'bubbles', 'pigeons'])
const animalObjects = new Set(['cat', 'dog', 'owl', 'horse', 'goat'])
const peopleOnlyObjects = new Set(['person', 'pilot', 'band', 'line'])
const vehicleObjects = new Set(['train', 'bike', 'car', 'bus'])
const furnitureObjects = new Set(['bed', 'table', 'desks', 'desk', 'bench', 'shelves', 'door', 'doors', 'window', 'gate'])
const deviceObjects = new Set(['phone', 'laptop', 'screen', 'radio', 'camera', 'lights', 'alarm', 'headlights'])
const smallObjects = new Set([
  'scale',
  'fruit',
  'luggage',
  'tickets',
  'milk',
  'pancakes',
  'paintings',
  'statue',
  'sketchbook',
  'sandcastle',
  'hat',
  'coffee',
  'cooler',
  'logs',
  'cart',
  'chart',
  'flowers',
  'wheelchair',
  'beakers',
  'board',
  'foam',
  'passports',
  'suitcases',
  'bucket',
  'eggs',
  'soup',
  'ring',
  'glass',
  'violin',
  'books',
  'flags',
  'balloon',
  'engine',
  'oil',
  'umbrella',
  'cake',
  'plants',
  'tablecloth',
  'candles',
  'sword',
  'rain machine',
  'script',
  'trail',
  'map',
  'backpack',
  'stove',
  'stall',
  'tower',
  'tent',
  'fire',
  'kite',
])

function blendColor(hex, amount = 0.38) {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  const mix = (channel) => Math.round(channel + (255 - channel) * amount)

  return `rgb(${mix(r)} ${mix(g)} ${mix(b)})`
}

function shadow(x, y, w, h, opacity = 0.18) {
  return <ellipse cx={x + w / 2} cy={y + h + 8} rx={w * 0.42} ry={Math.max(6, h * 0.1)} fill="#1f2925" opacity={opacity} />
}

function drawAtmosphere(name, layout, colors) {
  const { x, y, w, h } = layout

  if (name === 'rain') {
    return (
      <g key={name} opacity="0.38">
        {Array.from({ length: 32 }).map((_, index) => (
          <path
            key={index}
            d={`M${x + ((index * 23) % w)} ${y + ((index * 13) % h)}l-10 34`}
            stroke="#6c8790"
            strokeWidth="2"
            strokeLinecap="round"
          />
        ))}
      </g>
    )
  }

  if (name === 'snow' || name === 'confetti') {
    return (
      <g key={name} opacity={name === 'snow' ? '0.72' : '0.5'}>
        {Array.from({ length: name === 'snow' ? 34 : 24 }).map((_, index) => (
          <circle
            key={index}
            cx={x + ((index * 31) % w)}
            cy={y + ((index * 19) % h)}
            r={name === 'snow' ? 2.4 : 2}
            fill={name === 'snow' ? '#ffffff' : blendColor(colors[index % colors.length], 0.18)}
          />
        ))}
      </g>
    )
  }

  if (name === 'papers' || name === 'bubbles' || name === 'pigeons') {
    return (
      <g key={name}>
        {Array.from({ length: name === 'pigeons' ? 5 : 10 }).map((_, index) => {
          const px = x + ((index * 37) % w)
          const py = y + ((index * 21) % h)
          return name === 'bubbles' ? (
            <circle key={index} cx={px} cy={py} r={7 + (index % 3) * 3} fill="none" stroke="#b9d9d2" strokeWidth="2" opacity="0.55" />
          ) : name === 'pigeons' ? (
            <path key={index} d={`M${px} ${py}q9 -9 18 0q9 -9 18 0`} fill="none" stroke="#4c5855" strokeWidth="2" opacity="0.6" />
          ) : (
            <rect key={index} x={px} y={py} width="22" height="14" rx="1" fill="#f3eee2" stroke="#d5cdbf" transform={`rotate(${index % 2 ? -12 : 10} ${px} ${py})`} />
          )
        })}
      </g>
    )
  }

  return (
    <g key={name} opacity={name === 'fog' ? '0.24' : '0.42'}>
      <ellipse cx={x + w * 0.28} cy={y + h * 0.44} rx={w * 0.24} ry={h * 0.28} fill="#ffffff" />
      <ellipse cx={x + w * 0.52} cy={y + h * 0.42} rx={w * 0.3} ry={h * 0.34} fill="#ffffff" />
      <ellipse cx={x + w * 0.72} cy={y + h * 0.5} rx={w * 0.2} ry={h * 0.24} fill="#ffffff" />
    </g>
  )
}

function drawAnimal(name, layout, index, colors) {
  const { x, y, w, h } = layout
  const coat = blendColor(colors[index % colors.length], 0.46)
  const line = '#2e3835'

  return (
    <g key={name}>
      {shadow(x, y, w, h, 0.14)}
      <ellipse cx={x + w * 0.54} cy={y + h * 0.58} rx={w * 0.36} ry={h * 0.24} fill={coat} />
      <ellipse cx={x + w * 0.24} cy={y + h * 0.43} rx={w * 0.18} ry={h * 0.2} fill={coat} />
      <path d={`M${x + w * 0.14} ${y + h * 0.3}l8 -13 8 14`} fill={blendColor(colors[(index + 1) % colors.length], 0.34)} />
      <path d={`M${x + w * 0.8} ${y + h * 0.51}q${w * 0.24} -18 ${w * 0.18} 18`} fill="none" stroke={line} strokeWidth="4" strokeLinecap="round" opacity="0.7" />
      <path d={`M${x + w * 0.38} ${y + h * 0.77}v${h * 0.28}M${x + w * 0.66} ${y + h * 0.76}v${h * 0.28}`} stroke={line} strokeWidth="4" strokeLinecap="round" />
      <circle cx={x + w * 0.19} cy={y + h * 0.39} r="2.2" fill="#1c2421" />
    </g>
  )
}

function drawVehicle(name, layout, index, colors) {
  const { x, y, w, h } = layout
  const body = blendColor(colors[index % colors.length], 0.22)

  return (
    <g key={name}>
      {shadow(x, y, w, h, 0.2)}
      <path d={`M${x + 8} ${y + h * 0.24}h${w * 0.72}q${w * 0.18} 0 ${w * 0.23} ${h * 0.3}v${h * 0.26}h-${w * 0.94}z`} fill={body} />
      <rect x={x + w * 0.14} y={y + h * 0.34} width={w * 0.18} height={h * 0.18} rx="2" fill="#d9e7e6" opacity="0.86" />
      <rect x={x + w * 0.38} y={y + h * 0.34} width={w * 0.22} height={h * 0.18} rx="2" fill="#d9e7e6" opacity="0.86" />
      <circle cx={x + w * 0.24} cy={y + h * 0.84} r={Math.max(10, h * 0.13)} fill="#1f2925" />
      <circle cx={x + w * 0.76} cy={y + h * 0.84} r={Math.max(10, h * 0.13)} fill="#1f2925" />
    </g>
  )
}

function drawFurniture(name, layout, index, colors) {
  const { x, y, w, h } = layout
  const wood = name.includes('door') || name === 'table' || name === 'desk' || name === 'shelves'
  const fill = wood ? '#8a6f58' : blendColor(colors[index % colors.length], 0.48)

  return (
    <g key={name}>
      {shadow(x, y, w, h, 0.12)}
      <rect x={x} y={y} width={w} height={h} rx={name === 'window' ? 2 : 5} fill={fill} />
      <rect x={x + 8} y={y + 8} width={Math.max(16, w - 16)} height={Math.max(12, h * 0.18)} fill="#ffffff" opacity={name === 'window' ? '0.62' : '0.18'} />
      {name === 'window' ? (
        <>
          <path d={`M${x + w / 2} ${y}v${h}M${x} ${y + h / 2}h${w}`} stroke="#6d7d77" strokeWidth="3" opacity="0.62" />
          <rect x={x + 4} y={y + 4} width={w - 8} height={h - 8} fill="none" stroke="#374541" strokeWidth="2" opacity="0.36" />
        </>
      ) : null}
    </g>
  )
}

function drawDevice(name, layout, index, colors) {
  const { x, y, w, h } = layout
  const glow = name === 'alarm' || name === 'headlights' ? '#f4c95d' : '#d3ebe7'

  return (
    <g key={name}>
      {shadow(x, y, w, h, 0.1)}
      <rect x={x} y={y} width={w} height={h} rx="5" fill="#26312d" />
      <rect x={x + 5} y={y + 5} width={Math.max(12, w - 10)} height={Math.max(10, h - 10)} rx="3" fill={glow} opacity="0.72" />
      <path d={`M${x + 8} ${y + h - 8}h${Math.max(12, w - 16)}`} stroke={blendColor(colors[index % colors.length], 0.25)} strokeWidth="3" opacity="0.6" />
    </g>
  )
}

function drawSmallObject(name, layout, index, colors) {
  const { x, y, w, h } = layout
  const fill = blendColor(colors[index % colors.length], 0.34)
  const stroke = 'rgba(31, 41, 37, 0.36)'

  if (name === 'fire') {
    return (
      <g key={name}>
        {shadow(x, y, w, h, 0.24)}
        <path d={`M${x + w * 0.5} ${y + h * 0.08}c${w * 0.28} ${h * 0.28} ${w * 0.12} ${h * 0.62} 0 ${h * 0.82}c-${w * 0.28} -${h * 0.2} -${w * 0.34} -${h * 0.48} 0 -${h * 0.82}z`} fill="#d6683a" opacity="0.82" />
        <path d={`M${x + w * 0.48} ${y + h * 0.32}c${w * 0.18} ${h * 0.18} ${w * 0.08} ${h * 0.42} 0 ${h * 0.54}c-${w * 0.14} -${h * 0.12} -${w * 0.18} -${h * 0.34} 0 -${h * 0.54}z`} fill="#f4c95d" />
      </g>
    )
  }

  if (name === 'trail') {
    return <path key={name} d={`M${x} ${y + h}C${x + w * 0.2} ${y + h * 0.12} ${x + w * 0.64} ${y + h * 0.14} ${x + w} ${y - 8}`} fill="none" stroke="#b9a27d" strokeWidth="44" strokeLinecap="round" opacity="0.56" />
  }

  if (name === 'plants' || name === 'flowers') {
    return (
      <g key={name}>
        {Array.from({ length: 7 }).map((_, leaf) => (
          <path key={leaf} d={`M${x + w * 0.5} ${y + h}q${(leaf - 3) * 7} -${h * 0.42} ${((leaf * 19) % w) - w * 0.34} -${h * 0.78}`} fill="none" stroke={leaf % 2 ? '#3f6b55' : fill} strokeWidth="5" strokeLinecap="round" />
        ))}
      </g>
    )
  }

  return (
    <g key={name}>
      {shadow(x, y, w, h, 0.1)}
      <rect x={x} y={y} width={w} height={h} rx="4" fill={fill} stroke={stroke} />
      <path d={`M${x + w * 0.12} ${y + h * 0.22}h${w * 0.68}`} stroke="#ffffff" strokeWidth="4" opacity="0.28" strokeLinecap="round" />
      <path d={`M${x + w * 0.18} ${y + h * 0.74}c${w * 0.22} -${h * 0.2} ${w * 0.46} ${h * 0.12} ${w * 0.68} -${h * 0.1}`} fill="none" stroke="#26312d" strokeWidth="2" opacity="0.22" />
    </g>
  )
}

function drawSceneObject(name, index, colors) {
  const layout = objectLayouts[name] ?? {
    x: 70 + (index % 4) * 92,
    y: 88 + Math.floor(index / 4) * 82,
    w: 82,
    h: 58,
  }

  if (atmosphereObjects.has(name)) {
    return drawAtmosphere(name, layout, colors)
  }

  if (peopleOnlyObjects.has(name)) {
    return null
  }

  if (animalObjects.has(name)) {
    return drawAnimal(name, layout, index, colors)
  }

  if (vehicleObjects.has(name)) {
    return drawVehicle(name, layout, index, colors)
  }

  if (furnitureObjects.has(name)) {
    return drawFurniture(name, layout, index, colors)
  }

  if (deviceObjects.has(name) || smallObjects.has(name)) {
    return deviceObjects.has(name) ? drawDevice(name, layout, index, colors) : drawSmallObject(name, layout, index, colors)
  }

  return drawSmallObject(name, layout, index, colors)
}

function drawPeople(scene, colors) {
  const people = [
    { x: 104, y: 176, pose: 0 },
    { x: 248, y: 162, pose: 1 },
    { x: 390, y: 176, pose: 2 },
  ]

  return people.map((person, index) => (
    <g key={`${scene.id}-person-${index}`} opacity="0.92">
      {shadow(person.x - 20, person.y + 68, 46, 56, 0.16)}
      <circle cx={person.x} cy={person.y} r="14" fill="#c99267" />
      <path
        d={`M${person.x} ${person.y + 20}v58`}
        stroke={blendColor(colors[(index + 1) % colors.length], 0.28)}
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d={
          person.pose === 0
            ? `M${person.x - 8} ${person.y + 46}l-34 12M${person.x + 8} ${person.y + 46}l32 -20`
            : person.pose === 1
              ? `M${person.x - 8} ${person.y + 48}l-20 -26M${person.x + 8} ${person.y + 48}l28 24`
              : `M${person.x - 8} ${person.y + 48}l-28 26M${person.x + 8} ${person.y + 48}l34 -2`
        }
        stroke="#3b2f2f"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d={`M${person.x - 7} ${person.y + 76}l-16 38M${person.x + 7} ${person.y + 76}l20 36`}
        stroke="#3b2f2f"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </g>
  ))
}

function backgroundFor(scene, colors) {
  const indoor = /(apartment|kitchen|museum|office|hospital|laboratory|restaurant|library|garage|movie)/i.test(scene.setting)
  const wall = indoor ? '#edf1ec' : blendColor(colors[0], 0.78)
  const floor = indoor ? '#d5ddd6' : blendColor(colors[1], 0.68)

  return (
    <>
      <rect width="520" height="360" fill={wall} />
      <path d="M0 214h520v146H0z" fill={floor} />
      {indoor ? (
        <>
          <path d="M0 214L82 174h356l82 40" fill="#c7d1cb" opacity="0.28" />
          <path d="M78 214v146M438 214v146" stroke="#b7c1bb" strokeWidth="2" opacity="0.34" />
        </>
      ) : (
        <>
          <path d="M0 194C84 150 154 186 236 142C320 98 408 132 520 92v122H0z" fill={blendColor(colors[2], 0.7)} opacity="0.5" />
          <path d="M0 284C80 250 146 286 230 250C322 210 400 272 520 224v136H0z" fill={blendColor(colors[0], 0.62)} opacity="0.5" />
        </>
      )}
    </>
  )
}

function MidnightKnockIllustration({ scene, titleId, descId, shadowId, grainId }) {
  return (
    <svg className="scene-art" viewBox="0 0 520 360" role="img" aria-labelledby={`${titleId} ${descId}`}>
      <title id={titleId}>{scene.title}</title>
      <desc id={descId}>{scene.prompt}</desc>
      <defs>
        <linearGradient id={`${shadowId}-wall`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#253f3b" />
          <stop offset="0.58" stopColor="#172724" />
          <stop offset="1" stopColor="#0d1718" />
        </linearGradient>
        <radialGradient id={`${shadowId}-lamp`} cx="31%" cy="42%" r="45%">
          <stop offset="0" stopColor="#f4c86a" stopOpacity="0.75" />
          <stop offset="0.42" stopColor="#ba7f43" stopOpacity="0.28" />
          <stop offset="1" stopColor="#0d1718" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${shadowId}-phone`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#bff7ea" stopOpacity="0.9" />
          <stop offset="1" stopColor="#75c9bd" stopOpacity="0" />
        </radialGradient>
        <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="5" floodColor="#020908" floodOpacity="0.38" />
        </filter>
        <filter id={grainId}>
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="table" tableValues="0 0.06" />
          </feComponentTransfer>
        </filter>
      </defs>

      <rect width="520" height="360" fill={`url(#${shadowId}-wall)`} />
      <path d="M0 218h520v142H0z" fill="#19241f" />
      <path d="M0 218L82 176h356l82 42" fill="#31403a" opacity="0.34" />
      <path d="M75 218v142M438 218v142" stroke="#43544d" strokeWidth="2" opacity="0.22" />

      <g opacity="0.76">
        <rect x="250" y="50" width="132" height="116" rx="3" fill="#0a1113" stroke="#6d8987" strokeWidth="5" />
        <path d="M316 52v112M252 108h128" stroke="#6d8987" strokeWidth="3" />
        <rect x="260" y="60" width="112" height="96" fill="#273d48" opacity="0.74" />
        {Array.from({ length: 20 }).map((_, index) => (
          <path
            key={index}
            d={`M${264 + ((index * 19) % 112)} ${54 + ((index * 11) % 104)}l-14 38`}
            stroke="#9ab5ba"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.42"
          />
        ))}
      </g>

      <rect x="408" y="92" width="76" height="218" rx="2" fill="#4b3326" stroke="#1b1110" strokeWidth="4" />
      <rect x="418" y="108" width="56" height="78" rx="2" fill="#614636" opacity="0.88" />
      <rect x="418" y="198" width="56" height="84" rx="2" fill="#39261f" opacity="0.86" />
      <circle cx="466" cy="194" r="4" fill="#cfb36f" />
      <path d="M404 99c-30 36 -33 166 -8 212h31c-16 -54 -12 -157 15 -212z" fill="#090d0e" opacity="0.48" />
      <g opacity="0.9">
        <path d="M386 178q15 -10 30 -1" fill="none" stroke="#d8c58b" strokeWidth="3" strokeLinecap="round" />
        <path d="M382 165q20 -18 41 -2" fill="none" stroke="#d8c58b" strokeWidth="3" strokeLinecap="round" />
        <path d="M386 192q15 7 30 -2" fill="none" stroke="#d8c58b" strokeWidth="3" strokeLinecap="round" />
      </g>

      <g filter={`url(#${shadowId})`}>
        <ellipse cx="180" cy="326" rx="142" ry="24" fill="#050908" opacity="0.46" />
        <path d="M58 268c28 -46 102 -56 194 -28c27 8 48 31 50 56H68c-13 0 -18 -12 -10 -28z" fill="#705b50" />
        <path d="M75 246h210c18 0 34 15 34 33v28H62v-45c0 -9 5 -16 13 -16z" fill="#8f7869" />
        <path d="M82 224c28 -26 104 -26 145 7c10 8 5 25 -8 25H74c-17 0 -20 -20 -8 -32z" fill="#d5c8bb" />
        <path d="M168 222c36 5 75 31 81 64H95c7 -44 34 -69 73 -64z" fill="#314f4a" />
        <path d="M126 229c18 -31 68 -26 76 9c-22 10 -52 9 -76 -9z" fill="#b98364" />
        <path d="M132 219c10 -14 32 -16 45 -3c-12 6 -28 7 -45 3z" fill="#47352f" />
        <path d="M104 291c42 -17 120 -19 173 4" fill="none" stroke="#b9a99a" strokeWidth="5" opacity="0.5" />
      </g>

      <g filter={`url(#${shadowId})`}>
        <rect x="142" y="242" width="76" height="54" rx="4" fill="#4b352b" />
        <ellipse cx="180" cy="245" rx="42" ry="9" fill="#694b3b" />
        <g transform="translate(144 222) rotate(-7 37 15)">
          <path d="M0 8c17 -7 36 -7 54 1v24c-17 -7 -36 -7 -54 -1z" fill="#e6d9bd" />
          <path d="M54 9c10 -7 24 -6 36 1v24c-11 -7 -25 -8 -36 -1z" fill="#cbb995" />
          <path d="M54 9v24" stroke="#8b7657" strokeWidth="2" />
          <path d="M9 17c11 -3 23 -3 35 1M64 17c7 -2 14 -1 21 2M9 25c12 -3 23 -3 35 0M64 25c7 -2 14 -1 21 2" stroke="#6e604d" strokeWidth="1.4" opacity="0.58" />
        </g>
        <rect x="172" y="229" width="37" height="20" rx="4" fill="#17211f" />
        <rect x="176" y="232" width="29" height="14" rx="3" fill="#9ff2e3" />
        <ellipse cx="190" cy="239" rx="42" ry="28" fill={`url(#${shadowId}-phone)`} />
        <path d="M146 296v34M212 296v34" stroke="#2a1c18" strokeWidth="6" strokeLinecap="round" />
      </g>

      <g filter={`url(#${shadowId})`}>
        <ellipse cx="342" cy="320" rx="55" ry="9" fill="#050908" opacity="0.36" />
        <path d="M306 285c18 -30 62 -31 86 -7c-7 27 -61 42 -86 7z" fill="#2f3933" />
        <path d="M319 274c17 -12 43 -11 58 3c-12 9 -41 11 -58 -3z" fill="#465247" opacity="0.72" />
        <path d="M292 282c-7 -23 18 -39 39 -24c-1 22 -16 34 -39 24z" fill="#36423a" />
        <path d="M294 259l9 -18l9 22M316 259l15 -13l1 22" fill="#2f3933" />
        <path d="M382 279q35 -43 58 -6q-22 8 -44 34" fill="none" stroke="#202823" strokeWidth="7" strokeLinecap="round" />
        <path d="M322 302l-10 22M346 304l-5 22M369 300l15 20" stroke="#151d1a" strokeWidth="4.5" strokeLinecap="round" />
        <path d="M302 286q9 10 23 7" fill="none" stroke="#202823" strokeWidth="2" opacity="0.7" />
        <circle cx="302" cy="273" r="2.6" fill="#dbe9d8" />
        <path d="M293 278l-20 -7M294 282l-21 1M295 286l-17 10" stroke="#bac9bd" strokeWidth="1.2" strokeLinecap="round" opacity="0.58" />
      </g>

      <g opacity="0.84" filter={`url(#${shadowId})`}>
        <path d="M423 117c-22 12 -33 42 -31 74c1 29 18 54 44 63c24 -23 33 -102 -13 -137z" fill="#080c0d" />
        <ellipse cx="423" cy="120" rx="13" ry="15" fill="#111616" />
        <path d="M397 164q-28 6 -17 31q10 3 20 -6" fill="none" stroke="#0a0e0f" strokeWidth="10" strokeLinecap="round" />
        <ellipse cx="382" cy="184" rx="8" ry="9" fill="#111616" transform="rotate(-16 382 184)" />
        <path d="M393 210q20 14 44 4" fill="none" stroke="#050808" strokeWidth="5" strokeLinecap="round" opacity="0.7" />
      </g>

      <rect width="520" height="360" fill={`url(#${shadowId}-lamp)`} />
      <path d="M0 0h520v360H0z" fill="#020706" opacity="0.1" />
      <rect width="520" height="360" filter={`url(#${grainId})`} opacity="0.62" />
      <rect x="1" y="1" width="518" height="358" fill="none" stroke="rgba(232, 221, 198, 0.16)" strokeWidth="2" />
    </svg>
  )
}

export function SceneIllustration({ scene }) {
  const colors = scene.palette
  const [imageFailed, setImageFailed] = useState(false)
  const filterIdBase = useId().replaceAll(':', '')
  const shadowId = `${filterIdBase}-soft-shadow`
  const grainId = `${filterIdBase}-grain`
  const titleId = `${filterIdBase}-title`
  const descId = `${filterIdBase}-desc`

  if (scene.image && !imageFailed) {
    return (
      <img
        className="scene-art"
        src={scene.image}
        alt={scene.prompt}
        onError={() => setImageFailed(true)}
        loading="eager"
        decoding="sync"
        draggable="false"
      />
    )
  }

  if (scene.id === 'midnight-knock') {
    return <MidnightKnockIllustration scene={scene} titleId={titleId} descId={descId} shadowId={shadowId} grainId={grainId} />
  }

  return (
    <svg className="scene-art" viewBox="0 0 520 360" role="img" aria-labelledby={`${titleId} ${descId}`}>
      <title id={titleId}>{scene.title}</title>
      <desc id={descId}>{scene.prompt}</desc>
      <defs>
        <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="7" stdDeviation="5" floodColor="#19221f" floodOpacity="0.16" />
        </filter>
        <filter id={grainId}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="table" tableValues="0 0.055" />
          </feComponentTransfer>
        </filter>
      </defs>
      {backgroundFor(scene, colors)}
      <rect width="520" height="360" fill="#1e2723" opacity="0.04" />
      <g filter={`url(#${shadowId})`}>
        {scene.objects.map((object, index) => drawSceneObject(object, index, colors))}
        {drawPeople(scene, colors)}
      </g>
      <rect width="520" height="360" filter={`url(#${grainId})`} opacity="0.45" />
      <rect x="0" y="0" width="520" height="360" fill="none" stroke="rgba(31, 41, 37, 0.18)" />
    </svg>
  )
}
