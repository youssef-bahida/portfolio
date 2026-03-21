import React, { useRef, useState, useEffect, useCallback } from 'react'

// ─── NOISE ALGORITHMS ────────────────────────────────────────────────────────

function applyGaussianNoise(imageData, sigma) {
  const d = new Uint8ClampedArray(imageData.data)
  for (let i = 0; i < d.length; i += 4) {
    const g = gaussRandom() * sigma
    d[i] = clamp(d[i] + g)
    d[i+1] = clamp(d[i+1] + g)
    d[i+2] = clamp(d[i+2] + g)
  }
  return d
}

function applySaltPepper(imageData, prob) {
  const d = new Uint8ClampedArray(imageData.data)
  for (let i = 0; i < d.length; i += 4) {
    const r = Math.random()
    if (r < prob / 2) { d[i]=d[i+1]=d[i+2]=0 }
    else if (r < prob) { d[i]=d[i+1]=d[i+2]=255 }
  }
  return d
}

function applyPoissonNoise(imageData, scale) {
  const d = new Uint8ClampedArray(imageData.data)
  for (let i = 0; i < d.length; i += 4) {
    d[i]   = clamp(poissonSample(d[i] / 255 * scale) / scale * 255)
    d[i+1] = clamp(poissonSample(d[i+1] / 255 * scale) / scale * 255)
    d[i+2] = clamp(poissonSample(d[i+2] / 255 * scale) / scale * 255)
  }
  return d
}

function applySpeckleNoise(imageData, variance) {
  const d = new Uint8ClampedArray(imageData.data)
  for (let i = 0; i < d.length; i += 4) {
    const n = gaussRandom() * variance
    d[i]   = clamp(d[i]   + d[i]   * n)
    d[i+1] = clamp(d[i+1] + d[i+1] * n)
    d[i+2] = clamp(d[i+2] + d[i+2] * n)
  }
  return d
}

function applyUniformNoise(imageData, range) {
  const d = new Uint8ClampedArray(imageData.data)
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 2 * range
    d[i]   = clamp(d[i]   + n)
    d[i+1] = clamp(d[i+1] + n)
    d[i+2] = clamp(d[i+2] + n)
  }
  return d
}

function applyPeriodicNoise(imageData, w, h, freq, amp) {
  const d = new Uint8ClampedArray(imageData.data)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const n = Math.sin(2 * Math.PI * freq * x / w + 2 * Math.PI * freq * y / h) * amp
      d[i]   = clamp(d[i]   + n)
      d[i+1] = clamp(d[i+1] + n)
      d[i+2] = clamp(d[i+2] + n)
    }
  }
  return d
}

// ─── FILTER ALGORITHMS ───────────────────────────────────────────────────────

function applyMeanFilter(imageData, w, h, size) {
  return convolve(imageData, w, h, buildMeanKernel(size))
}

function applyGaussianFilter(imageData, w, h, size, sigma) {
  return convolve(imageData, w, h, buildGaussianKernel(size, sigma))
}

function applyMedianFilter(imageData, w, h, size) {
  const src = imageData.data
  const d = new Uint8ClampedArray(src)
  const half = Math.floor(size / 2)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const rVals = [], gVals = [], bVals = []
      for (let ky = -half; ky <= half; ky++) {
        for (let kx = -half; kx <= half; kx++) {
          const ny = Math.min(Math.max(y + ky, 0), h-1)
          const nx = Math.min(Math.max(x + kx, 0), w-1)
          const ni = (ny * w + nx) * 4
          rVals.push(src[ni]); gVals.push(src[ni+1]); bVals.push(src[ni+2])
        }
      }
      const i = (y * w + x) * 4
      d[i]   = median(rVals)
      d[i+1] = median(gVals)
      d[i+2] = median(bVals)
    }
  }
  return d
}

function applyBilateralFilter(imageData, w, h, d_param, sigmaColor, sigmaSpace) {
  const src = imageData.data
  const out = new Uint8ClampedArray(src)
  const half = Math.floor(d_param / 2)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      let rSum=0,gSum=0,bSum=0,wSum=0
      for (let ky = -half; ky <= half; ky++) {
        for (let kx = -half; kx <= half; kx++) {
          const ny = Math.min(Math.max(y+ky,0),h-1)
          const nx = Math.min(Math.max(x+kx,0),w-1)
          const ni = (ny*w+nx)*4
          const spaceDist = kx*kx + ky*ky
          const colorDist = Math.pow(src[ni]-src[i],2)+Math.pow(src[ni+1]-src[i+1],2)+Math.pow(src[ni+2]-src[i+2],2)
          const wt = Math.exp(-spaceDist/(2*sigmaSpace*sigmaSpace) - colorDist/(2*sigmaColor*sigmaColor))
          rSum+=src[ni]*wt; gSum+=src[ni+1]*wt; bSum+=src[ni+2]*wt; wSum+=wt
        }
      }
      out[i]=clamp(rSum/wSum); out[i+1]=clamp(gSum/wSum); out[i+2]=clamp(bSum/wSum)
    }
  }
  return out
}

function applySharpenFilter(imageData, w, h, strength) {
  const k = strength
  const kernel = [0,-k,0,-k,1+4*k,-k,0,-k,0]
  return convolve(imageData, w, h, { data: kernel, size: 3 })
}

function applyUnsharpMask(imageData, w, h, sigma, amount) {
  const blurred = applyGaussianFilter(imageData, w, h, 5, sigma)
  const src = imageData.data
  const d = new Uint8ClampedArray(src)
  for (let i = 0; i < d.length; i += 4) {
    d[i]   = clamp(src[i]   + amount * (src[i]   - blurred[i]))
    d[i+1] = clamp(src[i+1] + amount * (src[i+1] - blurred[i+1]))
    d[i+2] = clamp(src[i+2] + amount * (src[i+2] - blurred[i+2]))
  }
  return d
}

function applyLaplacianFilter(imageData, w, h) {
  const kernel = { data: [-1,-1,-1,-1,8,-1,-1,-1,-1], size: 3 }
  const edges = convolve(imageData, w, h, kernel)
  // normalize
  const d2 = new Uint8ClampedArray(imageData.data)
  for (let i = 0; i < d2.length; i+=4) {
    const v = Math.abs(edges[i])
    d2[i]=d2[i+1]=d2[i+2]=clamp(v*2)
  }
  return d2
}

function applyNlmFilter(imageData, w, h, h_param) {
  // Non-Local Means (simplified, fast version)
  const src = imageData.data
  const out = new Uint8ClampedArray(src)
  const patchSize = 3
  const searchSize = 11
  const halfP = Math.floor(patchSize/2)
  const halfS = Math.floor(searchSize/2)
  const h2 = h_param * h_param * patchSize * patchSize * 3

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let rSum=0,gSum=0,bSum=0,wSum=0
      for (let sy = -halfS; sy <= halfS; sy++) {
        for (let sx = -halfS; sx <= halfS; sx++) {
          const ny = Math.min(Math.max(y+sy,0),h-1)
          const nx = Math.min(Math.max(x+sx,0),w-1)
          let dist = 0
          for (let py = -halfP; py <= halfP; py++) {
            for (let px = -halfP; px <= halfP; px++) {
              const ay = Math.min(Math.max(y+py,0),h-1), ax = Math.min(Math.max(x+px,0),w-1)
              const by = Math.min(Math.max(ny+py,0),h-1), bx = Math.min(Math.max(nx+px,0),w-1)
              const ai = (ay*w+ax)*4, bi = (by*w+bx)*4
              dist += Math.pow(src[ai]-src[bi],2)+Math.pow(src[ai+1]-src[bi+1],2)+Math.pow(src[ai+2]-src[bi+2],2)
            }
          }
          const wt = Math.exp(-Math.max(dist,0)/h2)
          const ni = (ny*w+nx)*4
          rSum+=src[ni]*wt; gSum+=src[ni+1]*wt; bSum+=src[ni+2]*wt; wSum+=wt
        }
      }
      const i=(y*w+x)*4
      out[i]=clamp(rSum/wSum); out[i+1]=clamp(gSum/wSum); out[i+2]=clamp(bSum/wSum)
    }
  }
  return out
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function clamp(v) { return Math.max(0, Math.min(255, Math.round(v))) }

function gaussRandom() {
  let u=0, v=0
  while(u===0) u=Math.random()
  while(v===0) v=Math.random()
  return Math.sqrt(-2*Math.log(u)) * Math.cos(2*Math.PI*v)
}

function poissonSample(lambda) {
  if (lambda <= 0) return 0
  let L = Math.exp(-lambda), k = 0, p = 1
  do { k++; p *= Math.random() } while (p > L)
  return k - 1
}

function median(arr) {
  const s = [...arr].sort((a,b)=>a-b)
  return s[Math.floor(s.length/2)]
}

function buildMeanKernel(size) {
  const n = size * size
  return { data: new Array(n).fill(1/n), size }
}

function buildGaussianKernel(size, sigma) {
  const half = Math.floor(size/2)
  let data = [], sum = 0
  for (let y = -half; y <= half; y++) {
    for (let x = -half; x <= half; x++) {
      const v = Math.exp(-(x*x+y*y)/(2*sigma*sigma))
      data.push(v); sum += v
    }
  }
  data = data.map(v => v/sum)
  return { data, size }
}

function convolve(imageData, w, h, kernel) {
  const src = imageData.data
  const d = new Uint8ClampedArray(src)
  const half = Math.floor(kernel.size/2)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r=0,g=0,b=0
      for (let ky = 0; ky < kernel.size; ky++) {
        for (let kx = 0; kx < kernel.size; kx++) {
          const ny = Math.min(Math.max(y+ky-half,0),h-1)
          const nx = Math.min(Math.max(x+kx-half,0),w-1)
          const ni = (ny*w+nx)*4
          const kv = kernel.data[ky*kernel.size+kx]
          r+=src[ni]*kv; g+=src[ni+1]*kv; b+=src[ni+2]*kv
        }
      }
      const i=(y*w+x)*4
      d[i]=clamp(r); d[i+1]=clamp(g); d[i+2]=clamp(b)
    }
  }
  return d
}

function computePSNR(orig, noisy) {
  let mse = 0
  for (let i = 0; i < orig.length; i += 4) {
    mse += Math.pow(orig[i]-noisy[i],2)+Math.pow(orig[i+1]-noisy[i+1],2)+Math.pow(orig[i+2]-noisy[i+2],2)
  }
  mse /= (orig.length/4)*3
  if (mse === 0) return Infinity
  return 10*Math.log10(255*255/mse)
}

// ─── NOISE CONFIG ─────────────────────────────────────────────────────────────

const NOISES = [
  { id:'gaussian', label:'Gaussian', color:'#ff6b35', icon:'〜',
    params:[{ key:'sigma', label:'Sigma (σ)', min:1, max:80, default:25, step:1 }],
    apply:(id,w,h,p)=>applyGaussianNoise(id,p.sigma)
  },
  { id:'salt_pepper', label:'Salt & Pepper', color:'#ff9a3c', icon:'※',
    params:[{ key:'prob', label:'Probability', min:0.01, max:0.5, default:0.1, step:0.01 }],
    apply:(id,w,h,p)=>applySaltPepper(id,p.prob)
  },
  { id:'poisson', label:'Poisson', color:'#ffcc00', icon:'◈',
    params:[{ key:'scale', label:'Scale λ', min:10, max:200, default:80, step:5 }],
    apply:(id,w,h,p)=>applyPoissonNoise(id,p.scale)
  },
  { id:'speckle', label:'Speckle', color:'#ff4d88', icon:'✦',
    params:[{ key:'variance', label:'Variance', min:0.05, max:1.0, default:0.3, step:0.05 }],
    apply:(id,w,h,p)=>applySpeckleNoise(id,p.variance)
  },
  { id:'uniform', label:'Uniform', color:'#e040fb', icon:'▦',
    params:[{ key:'range', label:'Range', min:5, max:100, default:40, step:5 }],
    apply:(id,w,h,p)=>applyUniformNoise(id,p.range)
  },
  { id:'periodic', label:'Periodic', color:'#ff3d71', icon:'⌇',
    params:[
      { key:'freq', label:'Frequency', min:1, max:20, default:5, step:1 },
      { key:'amp', label:'Amplitude', min:5, max:80, default:30, step:5 },
    ],
    apply:(id,w,h,p)=>applyPeriodicNoise(id,w,h,p.freq,p.amp)
  },
]

const FILTERS = [
  { id:'mean', label:'Mean', color:'#00e5ff', icon:'◻',
    params:[{ key:'size', label:'Kernel Size', min:3, max:15, default:5, step:2 }],
    apply:(id,w,h,p)=>applyMeanFilter(id,w,h,p.size)
  },
  { id:'gaussian', label:'Gaussian', color:'#00bcd4', icon:'◯',
    params:[
      { key:'size', label:'Kernel Size', min:3, max:11, default:5, step:2 },
      { key:'sigma', label:'Sigma (σ)', min:0.5, max:5, default:1.5, step:0.5 },
    ],
    apply:(id,w,h,p)=>applyGaussianFilter(id,w,h,p.size,p.sigma)
  },
  { id:'median', label:'Median', color:'#26c6da', icon:'◈',
    params:[{ key:'size', label:'Kernel Size', min:3, max:11, default:3, step:2 }],
    apply:(id,w,h,p)=>applyMedianFilter(id,w,h,p.size)
  },
  { id:'bilateral', label:'Bilateral', color:'#4dd0e1', icon:'⬡',
    params:[
      { key:'d', label:'Diameter', min:3, max:11, default:7, step:2 },
      { key:'sigmaColor', label:'σ Color', min:10, max:150, default:75, step:5 },
      { key:'sigmaSpace', label:'σ Space', min:5, max:75, default:30, step:5 },
    ],
    apply:(id,w,h,p)=>applyBilateralFilter(id,w,h,p.d,p.sigmaColor,p.sigmaSpace)
  },
  { id:'sharpen', label:'Sharpen', color:'#7df9ff', icon:'◇',
    params:[{ key:'strength', label:'Strength', min:0.1, max:2.0, default:0.5, step:0.1 }],
    apply:(id,w,h,p)=>applySharpenFilter(id,w,h,p.strength)
  },
  { id:'unsharp', label:'Unsharp Mask', color:'#b2ebf2', icon:'⬟',
    params:[
      { key:'sigma', label:'Sigma', min:0.5, max:3, default:1.5, step:0.5 },
      { key:'amount', label:'Amount', min:0.5, max:3, default:1.5, step:0.5 },
    ],
    apply:(id,w,h,p)=>applyUnsharpMask(id,w,h,p.sigma,p.amount)
  },
  { id:'laplacian', label:'Laplacian Edge', color:'#80deea', icon:'△',
    params:[],
    apply:(id,w,h,p)=>applyLaplacianFilter(id,w,h)
  },
  { id:'nlm', label:'Non-Local Means', color:'#00acc1', icon:'⊛',
    params:[{ key:'h', label:'Filter Strength h', min:5, max:40, default:15, step:5 }],
    apply:(id,w,h,p)=>applyNlmFilter(id,w,h,p.h)
  },
]

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function Badge({ children, color }) {
  return (
    <span style={{
      background: color+'22', border: `1px solid ${color}55`,
      color, padding:'2px 8px', borderRadius:20, fontSize:'0.75rem',
      fontFamily:'Space Mono, monospace', letterSpacing:'0.5px'
    }}>{children}</span>
  )
}

function ParamSlider({ param, value, onChange, accentColor }) {
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <span style={{ color:'#9090a8', fontSize:'0.78rem' }}>{param.label}</span>
        <span style={{ color: accentColor, fontFamily:'Space Mono, monospace', fontSize:'0.78rem' }}>{value}</span>
      </div>
      <input type="range" min={param.min} max={param.max} step={param.step} value={value}
        onChange={e=>onChange(param.key, parseFloat(e.target.value))}
        style={{ '--accent': accentColor }} />
    </div>
  )
}

function NoiseCard({ noise, active, onToggle, params, onParamChange }) {
  return (
    <div onClick={onToggle} style={{
      border: `1px solid ${active ? noise.color+'66' : 'rgba(255,255,255,0.07)'}`,
      background: active ? noise.color+'11' : '#111118',
      borderRadius:10, padding:'12px 14px', cursor:'pointer',
      transition:'all 0.2s', marginBottom:8,
      boxShadow: active ? `0 0 16px ${noise.color}22` : 'none'
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: active&&noise.params.length?10:0 }}>
        <span style={{ fontSize:'1.1rem', color: noise.color }}>{noise.icon}</span>
        <span style={{ fontWeight:700, color: active ? noise.color : '#f0f0f8', fontSize:'0.9rem' }}>{noise.label}</span>
        {active && <Badge color={noise.color}>ON</Badge>}
      </div>
      {active && noise.params.length > 0 && (
        <div onClick={e=>e.stopPropagation()}>
          {noise.params.map(p=>(
            <ParamSlider key={p.key} param={p} value={params[p.key]??p.default}
              onChange={onParamChange} accentColor={noise.color} />
          ))}
        </div>
      )}
    </div>
  )
}

function FilterCard({ filter, active, onToggle, params, onParamChange }) {
  return (
    <div onClick={onToggle} style={{
      border: `1px solid ${active ? filter.color+'66' : 'rgba(255,255,255,0.07)'}`,
      background: active ? filter.color+'11' : '#111118',
      borderRadius:10, padding:'12px 14px', cursor:'pointer',
      transition:'all 0.2s', marginBottom:8,
      boxShadow: active ? `0 0 16px ${filter.color}22` : 'none'
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: active&&filter.params.length?10:0 }}>
        <span style={{ fontSize:'1.1rem', color: filter.color }}>{filter.icon}</span>
        <span style={{ fontWeight:700, color: active ? filter.color : '#f0f0f8', fontSize:'0.9rem' }}>{filter.label}</span>
        {active && <Badge color={filter.color}>ON</Badge>}
      </div>
      {active && filter.params.length > 0 && (
        <div onClick={e=>e.stopPropagation()}>
          {filter.params.map(p=>(
            <ParamSlider key={p.key} param={p} value={params[p.key]??p.default}
              onChange={onParamChange} accentColor={filter.color} />
          ))}
        </div>
      )}
    </div>
  )
}

function CanvasView({ label, canvasRef, color, psnr, badge }) {
  return (
    <div style={{ flex:1, minWidth:0 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
        <span style={{ width:8, height:8, borderRadius:'50%', background: color, display:'inline-block', boxShadow:`0 0 6px ${color}` }}/>
        <span style={{ fontWeight:700, fontSize:'0.85rem', color:'#9090a8', letterSpacing:'0.5px', textTransform:'uppercase' }}>{label}</span>
        {badge && <Badge color={color}>{badge}</Badge>}
        {psnr !== null && psnr !== undefined && (
          <span style={{ marginLeft:'auto', fontFamily:'Space Mono, monospace', fontSize:'0.75rem',
            color: psnr>30 ? '#22c55e' : psnr>20 ? '#eab308' : '#ef4444' }}>
            PSNR: {isFinite(psnr) ? psnr.toFixed(1)+'dB' : '∞'}
          </span>
        )}
      </div>
      <div style={{ border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, overflow:'hidden',
        background:'#0a0a0f', aspectRatio:'1', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <canvas ref={canvasRef} style={{ width:'100%', height:'100%', objectFit:'contain' }} />
      </div>
    </div>
  )
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [origImageData, setOrigImageData] = useState(null)
  const [imgW, setImgW] = useState(0)
  const [imgH, setImgH] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const [activeNoises, setActiveNoises] = useState({})
  const [noiseParams, setNoiseParams] = useState(() => {
    const init = {}
    NOISES.forEach(n => {
      init[n.id] = {}
      n.params.forEach(p => { init[n.id][p.key] = p.default })
    })
    return init
  })

  const [activeFilter, setActiveFilter] = useState(null)
  const [filterParams, setFilterParams] = useState(() => {
    const init = {}
    FILTERS.forEach(f => {
      init[f.id] = {}
      f.params.forEach(p => { init[f.id][p.key] = p.default })
    })
    return init
  })

  const [noisePSNR, setNoisePSNR] = useState(null)
  const [filterPSNR, setFilterPSNR] = useState(null)
  const [activeTab, setActiveTab] = useState('noise') // 'noise' | 'filter'

  const origCanvasRef = useRef(null)
  const noisedCanvasRef = useRef(null)
  const filteredCanvasRef = useRef(null)
  const fileInputRef = useRef(null)

  // Draw image data onto canvas
  const drawToCanvas = useCallback((canvasRef, data, w, h) => {
    const canvas = canvasRef.current
    if (!canvas || !data) return
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    const id = ctx.createImageData(w, h)
    id.data.set(data)
    ctx.putImageData(id, 0, 0)
  }, [])

  // Draw placeholder
  const drawPlaceholder = useCallback((canvasRef, text, color) => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = 300; canvas.height = 300
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#111118'
    ctx.fillRect(0,0,300,300)
    ctx.font = '600 13px Syne, sans-serif'
    ctx.fillStyle = color || '#5a5a72'
    ctx.textAlign = 'center'
    ctx.fillText(text, 150, 155)
  }, [])

  useEffect(() => {
    drawPlaceholder(origCanvasRef, 'Drop or upload an image', '#5a5a72')
    drawPlaceholder(noisedCanvasRef, 'Noised image will appear here', '#ff6b3555')
    drawPlaceholder(filteredCanvasRef, 'Filtered image will appear here', '#00e5ff55')
  }, [drawPlaceholder])

  const loadImage = useCallback((file) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const MAX = 400
        let w = img.width, h = img.height
        if (w > MAX || h > MAX) {
          const r = Math.min(MAX/w, MAX/h)
          w = Math.round(w*r); h = Math.round(h*r)
        }
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        const imageData = ctx.getImageData(0, 0, w, h)
        setOrigImageData(imageData)
        setImgW(w); setImgH(h)
        drawToCanvas(origCanvasRef, imageData.data, w, h)
        drawPlaceholder(noisedCanvasRef, 'Select noise(s) and apply', '#ff6b3555')
        drawPlaceholder(filteredCanvasRef, 'Apply noise first', '#00e5ff55')
        setNoisePSNR(null); setFilterPSNR(null)
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  }, [drawToCanvas, drawPlaceholder])

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) loadImage(file)
  }, [loadImage])

  const applyNoises = useCallback(async () => {
    if (!origImageData) return
    setProcessing(true)
    await new Promise(r => setTimeout(r, 10))
    const activeList = NOISES.filter(n => activeNoises[n.id])
    if (activeList.length === 0) {
      drawToCanvas(noisedCanvasRef, origImageData.data, imgW, imgH)
      setNoisePSNR(Infinity)
      setProcessing(false)
      return
    }
    let currentData = new Uint8ClampedArray(origImageData.data)
    for (const noise of activeList) {
      const fakeId = { data: currentData }
      const result = noise.apply(fakeId, imgW, imgH, noiseParams[noise.id])
      currentData = result
    }
    drawToCanvas(noisedCanvasRef, currentData, imgW, imgH)
    setNoisePSNR(computePSNR(origImageData.data, currentData))
    setProcessing(false)
    return currentData
  }, [origImageData, imgW, imgH, activeNoises, noiseParams, drawToCanvas])

  const applyFilter = useCallback(async (noisedData) => {
    if (!noisedData || !activeFilter) return
    setProcessing(true)
    await new Promise(r => setTimeout(r, 10))
    const filter = FILTERS.find(f => f.id === activeFilter)
    if (!filter) { setProcessing(false); return }
    const fakeId = { data: noisedData }
    const result = filter.apply(fakeId, imgW, imgH, filterParams[activeFilter])
    drawToCanvas(filteredCanvasRef, result, imgW, imgH)
    setFilterPSNR(computePSNR(origImageData.data, result))
    setProcessing(false)
  }, [activeFilter, imgW, imgH, filterParams, drawToCanvas, origImageData])

  const handleProcess = useCallback(async () => {
    const noisedData = await applyNoises()
    if (noisedData && activeFilter) {
      await applyFilter(noisedData)
    }
  }, [applyNoises, applyFilter, activeFilter])

  const loadDemo = useCallback(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 300; canvas.height = 300
    const ctx = canvas.getContext('2d')
    // Paint a colorful scene
    const grad = ctx.createLinearGradient(0,0,300,300)
    grad.addColorStop(0,'#1a1a3e'); grad.addColorStop(1,'#2d1b4e')
    ctx.fillStyle = grad; ctx.fillRect(0,0,300,300)
    // Moon
    ctx.fillStyle='#fff9e0'
    ctx.beginPath(); ctx.arc(220,70,40,0,Math.PI*2); ctx.fill()
    // Crater
    ctx.fillStyle='#e8d9a0'; ctx.globalAlpha=0.5
    ctx.beginPath(); ctx.arc(210,65,12,0,Math.PI*2); ctx.fill()
    ctx.beginPath(); ctx.arc(230,80,7,0,Math.PI*2); ctx.fill()
    ctx.globalAlpha=1
    // Mountains
    ctx.fillStyle='#2d2d5e'
    ctx.beginPath(); ctx.moveTo(0,300); ctx.lineTo(0,180); ctx.lineTo(80,100); ctx.lineTo(160,180); ctx.lineTo(240,80); ctx.lineTo(300,160); ctx.lineTo(300,300); ctx.fill()
    // Snow caps
    ctx.fillStyle='#e8eaf6'
    ctx.beginPath(); ctx.moveTo(80,100); ctx.lineTo(60,130); ctx.lineTo(100,130); ctx.closePath(); ctx.fill()
    ctx.beginPath(); ctx.moveTo(240,80); ctx.lineTo(220,115); ctx.lineTo(260,115); ctx.closePath(); ctx.fill()
    // Stars
    for(let i=0;i<80;i++){
      ctx.fillStyle=`rgba(255,255,255,${Math.random()*0.8+0.2})`
      ctx.beginPath(); ctx.arc(Math.random()*300,Math.random()*150,Math.random()*1.5+0.3,0,Math.PI*2); ctx.fill()
    }
    // Lake reflection
    const lakeGrad = ctx.createLinearGradient(0,220,0,300)
    lakeGrad.addColorStop(0,'#1a2a4a'); lakeGrad.addColorStop(1,'#0d1a2e')
    ctx.fillStyle=lakeGrad
    ctx.beginPath(); ctx.ellipse(150,290,180,60,0,0,Math.PI*2); ctx.fill()
    // Moon reflection
    ctx.fillStyle='rgba(255,249,200,0.3)'
    ctx.beginPath(); ctx.ellipse(150,280,20,8,0,0,Math.PI*2); ctx.fill()

    const imageData = ctx.getImageData(0,0,300,300)
    setOrigImageData(imageData)
    setImgW(300); setImgH(300)
    drawToCanvas(origCanvasRef, imageData.data, 300, 300)
    drawPlaceholder(noisedCanvasRef, 'Apply noises below', '#ff6b3555')
    drawPlaceholder(filteredCanvasRef, 'Then apply a filter', '#00e5ff55')
    setNoisePSNR(null); setFilterPSNR(null)
  }, [drawToCanvas, drawPlaceholder])

  const toggleNoise = (id) => setActiveNoises(prev => ({...prev, [id]: !prev[id]}))
  const updateNoiseParam = (noiseId, key, val) => setNoiseParams(prev=>({...prev,[noiseId]:{...prev[noiseId],[key]:val}}))
  const updateFilterParam = (filterId, key, val) => setFilterParams(prev=>({...prev,[filterId]:{...prev[filterId],[key]:val}}))

  const activeNoisesCount = Object.values(activeNoises).filter(Boolean).length

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', background:'#0a0a0f' }}>
      {/* HEADER */}
      <header style={{
        borderBottom:'1px solid rgba(255,255,255,0.06)',
        padding:'16px 24px',
        display:'flex', alignItems:'center', gap:16,
        background:'rgba(10,10,15,0.95)',
        backdropFilter:'blur(12px)',
        position:'sticky', top:0, zIndex:100
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#ff6b35,#a259ff)', display:'flex',alignItems:'center',justifyContent:'center', fontSize:'1.1rem' }}>◈</div>
          <div>
            <div style={{ fontWeight:800, fontSize:'1.1rem', letterSpacing:'-0.5px' }}>Image Lab</div>
            <div style={{ fontSize:'0.7rem', color:'#5a5a72', fontFamily:'Space Mono, monospace' }}>Noise & Filters Studio</div>
          </div>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
          {activeNoisesCount > 0 && <Badge color="#ff6b35">{activeNoisesCount} noise{activeNoisesCount>1?'s':''}</Badge>}
          {activeFilter && <Badge color="#00e5ff">{FILTERS.find(f=>f.id===activeFilter)?.label}</Badge>}
          <button onClick={handleProcess} disabled={!origImageData || processing}
            style={{
              background: processing ? '#22223a' : 'linear-gradient(135deg,#ff6b35,#a259ff)',
              border:'none', color:'#fff', padding:'8px 20px', borderRadius:8,
              fontWeight:700, fontSize:'0.85rem', opacity: !origImageData||processing ? 0.5 : 1,
              transition:'all 0.2s', letterSpacing:'0.5px'
            }}>
            {processing ? '⟳ Processing...' : '▶ Process'}
          </button>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

        {/* LEFT PANEL — NOISE */}
        <div style={{
          width:240, borderRight:'1px solid rgba(255,255,255,0.06)',
          display:'flex', flexDirection:'column', overflow:'hidden',
          background:'#0d0d15'
        }}>
          <div style={{ padding:'14px 14px 10px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
              <span style={{ color:'#ff6b35', fontSize:'0.9rem' }}>◈</span>
              <span style={{ fontWeight:800, fontSize:'0.85rem', color:'#ff6b35', letterSpacing:'1px', textTransform:'uppercase' }}>Noise</span>
            </div>
            <div style={{ fontSize:'0.7rem', color:'#5a5a72', fontFamily:'Space Mono,monospace' }}>Stack multiple noises</div>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:10 }}>
            {NOISES.map(noise=>(
              <NoiseCard key={noise.id} noise={noise}
                active={!!activeNoises[noise.id]}
                onToggle={()=>toggleNoise(noise.id)}
                params={noiseParams[noise.id]}
                onParamChange={(key,val)=>updateNoiseParam(noise.id,key,val)}
              />
            ))}
          </div>
        </div>

        {/* CENTER — CANVAS AREA */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          {/* Canvas row */}
          <div style={{ flex:1, padding:20, display:'flex', gap:16, overflow:'hidden', minHeight:0 }}>
            <CanvasView label="Original" canvasRef={origCanvasRef} color="#a259ff" />
            <CanvasView label="Noised" canvasRef={noisedCanvasRef} color="#ff6b35" psnr={noisePSNR} badge={activeNoisesCount>0?`${activeNoisesCount}x`:null} />
            <CanvasView label="Filtered" canvasRef={filteredCanvasRef} color="#00e5ff" psnr={filterPSNR} badge={activeFilter?FILTERS.find(f=>f.id===activeFilter)?.label:null} />
          </div>

          {/* BOTTOM — Upload & Info */}
          <div style={{
            borderTop:'1px solid rgba(255,255,255,0.06)',
            padding:'14px 20px',
            display:'flex', gap:12, alignItems:'center',
            background:'#0d0d15'
          }}>
            {/* Drop zone */}
            <div
              onClick={()=>fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={e=>{e.preventDefault();setIsDragging(true)}}
              onDragLeave={()=>setIsDragging(false)}
              style={{
                border:`2px dashed ${isDragging?'#a259ff':'rgba(255,255,255,0.15)'}`,
                borderRadius:10, padding:'10px 20px',
                cursor:'pointer', transition:'all 0.2s',
                background: isDragging ? '#a259ff11' : 'transparent',
                display:'flex', alignItems:'center', gap:10, flex:1
              }}>
              <span style={{ fontSize:'1.3rem' }}>📁</span>
              <div>
                <div style={{ fontWeight:700, fontSize:'0.85rem' }}>Upload Image</div>
                <div style={{ fontSize:'0.7rem', color:'#5a5a72' }}>PNG, JPG, GIF — drag or click</div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" style={{display:'none'}}
                onChange={e=>e.target.files[0]&&loadImage(e.target.files[0])} />
            </div>
            <button onClick={loadDemo} style={{
              background:'#1a1a24', border:'1px solid rgba(255,255,255,0.1)',
              color:'#f0f0f8', padding:'10px 18px', borderRadius:10,
              fontWeight:700, fontSize:'0.82rem', transition:'all 0.2s'
            }}>✦ Demo Image</button>

            {/* PSNR legend */}
            <div style={{ display:'flex', gap:12, fontSize:'0.72rem', fontFamily:'Space Mono,monospace', color:'#5a5a72' }}>
              <span style={{ color:'#22c55e' }}>● &gt;30dB good</span>
              <span style={{ color:'#eab308' }}>● 20-30dB ok</span>
              <span style={{ color:'#ef4444' }}>● &lt;20dB bad</span>
            </div>

            <button onClick={handleProcess} disabled={!origImageData||processing}
              style={{
                background: processing ? '#22223a' : 'linear-gradient(135deg,#ff6b35,#a259ff)',
                border:'none', color:'#fff', padding:'10px 24px', borderRadius:10,
                fontWeight:800, fontSize:'0.9rem', opacity:!origImageData||processing?0.5:1,
                transition:'all 0.2s', letterSpacing:'0.5px', whiteSpace:'nowrap'
              }}>
              {processing ? '⟳ Processing...' : '▶ Apply All'}
            </button>
          </div>
        </div>

        {/* RIGHT PANEL — FILTERS */}
        <div style={{
          width:240, borderLeft:'1px solid rgba(255,255,255,0.06)',
          display:'flex', flexDirection:'column', overflow:'hidden',
          background:'#0d0d15'
        }}>
          <div style={{ padding:'14px 14px 10px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
              <span style={{ color:'#00e5ff', fontSize:'0.9rem' }}>◯</span>
              <span style={{ fontWeight:800, fontSize:'0.85rem', color:'#00e5ff', letterSpacing:'1px', textTransform:'uppercase' }}>Filter</span>
            </div>
            <div style={{ fontSize:'0.7rem', color:'#5a5a72', fontFamily:'Space Mono,monospace' }}>Choose one denoising filter</div>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:10 }}>
            {FILTERS.map(filter=>(
              <FilterCard key={filter.id} filter={filter}
                active={activeFilter===filter.id}
                onToggle={()=>setActiveFilter(prev=>prev===filter.id?null:filter.id)}
                params={filterParams[filter.id]}
                onParamChange={(key,val)=>updateFilterParam(filter.id,key,val)}
              />
            ))}
          </div>

          {/* How to use */}
          <div style={{
            padding:12, borderTop:'1px solid rgba(255,255,255,0.06)',
            fontSize:'0.72rem', color:'#5a5a72', lineHeight:1.6
          }}>
            <div style={{ fontWeight:700, color:'#9090a8', marginBottom:6, fontFamily:'Space Mono,monospace' }}>HOW TO USE</div>
            <div>① Load or use demo image</div>
            <div>② Toggle noise(s) on left</div>
            <div>③ Pick a filter on right</div>
            <div>④ Hit <span style={{color:'#a259ff'}}>▶ Apply All</span></div>
            <div style={{marginTop:6, color:'#3a3a5a'}}>PSNR measures quality vs original</div>
          </div>
        </div>
      </div>
    </div>
  )
}
