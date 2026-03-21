# Image Lab — Noise & Filters Studio

> A React + Vite web app for exploring image noise models and denoising filters.

## Features

**6 Noise Models**
- Gaussian noise (σ control)
- Salt & Pepper (probability control)
- Poisson noise (λ scale)
- Speckle noise (variance control)
- Uniform noise (range control)
- Periodic / sinusoidal noise (frequency + amplitude)

**8 Denoising Filters**
- Mean filter (kernel size)
- Gaussian filter (size + σ)
- Median filter (kernel size)
- Bilateral filter (diameter + σ color + σ space)
- Sharpen filter
- Unsharp Mask
- Laplacian edge detection
- Non-Local Means (NLM)

**Live PSNR metric** — compares noised/filtered output to original image quality in dB.

## Stack

- React 18
- Vite 5
- Pure Canvas API (no dependencies for image processing)
- Google Fonts (Syne + Space Mono)

## Deploy to Vercel (from GitHub)

1. Push this folder to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
3. Framework: **Vite** (auto-detected)
4. Click Deploy ✓

## Run Locally

```bash
npm install
npm run dev
```
