import { formatDate, formatGHS } from './supabase'
import { jsPDF } from 'jspdf'

export type ReceiptInfo = {
  eventName: string
  eventDate?: string | null
  venueName?: string | null
  venueAddress?: string | null
  attendeeName: string
  code: string
  type: 'ticket' | 'registration'
  amount?: number | null
  quantity?: number | null
  organizationName?: string | null
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(' ')
  let line = ''
  let currentY = y

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' '
    const metrics = ctx.measureText(testLine)
    const testWidth = metrics.width
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, currentY)
      line = words[n] + ' '
      currentY += lineHeight
    } else {
      line = testLine
    }
  }
  ctx.fillText(line.trim(), x, currentY)
  return currentY
}

function renderReceiptCanvas(
  info: ReceiptInfo,
  qrCanvasElement?: HTMLCanvasElement | null
): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas')
  const width = 1200
  const height = 1680
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // Base background
  ctx.fillStyle = '#F4F4F6'
  ctx.fillRect(0, 0, width, height)

  // Card bounds
  const cardX = 60
  const cardY = 60
  const cardW = width - 120
  const cardH = height - 120
  const radius = 36

  // Main ticket container
  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.08)'
  ctx.shadowBlur = 40
  ctx.shadowOffsetY = 16
  ctx.fillStyle = '#FFFFFF'
  roundedRect(ctx, cardX, cardY, cardW, cardH, radius)
  ctx.fill()
  ctx.restore()

  // Top header banner
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(cardX + radius, cardY)
  ctx.lineTo(cardX + cardW - radius, cardY)
  ctx.arcTo(cardX + cardW, cardY, cardX + cardW, cardY + radius, radius)
  ctx.lineTo(cardX + cardW, cardY + 140)
  ctx.lineTo(cardX, cardY + 140)
  ctx.lineTo(cardX, cardY + radius)
  ctx.arcTo(cardX, cardY, cardX + radius, cardY, radius)
  ctx.closePath()
  ctx.fillStyle = '#C81E2C'
  ctx.fill()
  ctx.restore()

  // Header Title
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 36px "Manrope", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(
    (info.organizationName || 'UPTOWN VIBEZ CITY').toUpperCase(),
    width / 2,
    cardY + 62
  )

  ctx.font = '600 22px "Manrope", sans-serif'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.fillText(
    info.type === 'ticket' ? 'OFFICIAL ADMISSION TICKET & RECEIPT' : 'EVENT REGISTRATION PASS',
    width / 2,
    cardY + 104
  )

  // Event Title
  let currentY = cardY + 220
  ctx.fillStyle = '#111111'
  ctx.font = 'bold 48px "Fraunces", serif'
  ctx.textAlign = 'center'
  const finalTitleY = wrapText(ctx, info.eventName || 'Event', width / 2, currentY, cardW - 140, 58)
  currentY = finalTitleY + 50

  // Date & Venue Details
  ctx.font = '500 28px "Manrope", sans-serif'
  ctx.fillStyle = '#555555'
  if (info.eventDate) {
    ctx.fillText(`📅  ${formatDate(info.eventDate)}`, width / 2, currentY)
    currentY += 44
  }
  const venueText = [info.venueName, info.venueAddress].filter(Boolean).join(' · ')
  if (venueText) {
    ctx.fillText(`📍  ${venueText}`, width / 2, currentY)
    currentY += 44
  }

  // Dashed Ticket Divider with circular notches
  currentY += 24
  ctx.save()
  ctx.strokeStyle = '#D1D5DB'
  ctx.lineWidth = 4
  ctx.setLineDash([16, 12])
  ctx.beginPath()
  ctx.moveTo(cardX + 45, currentY)
  ctx.lineTo(cardX + cardW - 45, currentY)
  ctx.stroke()
  ctx.restore()

  // Side cut notches
  ctx.fillStyle = '#F4F4F6'
  ctx.beginPath()
  ctx.arc(cardX, currentY, 28, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cardX + cardW, currentY, 28, 0, Math.PI * 2)
  ctx.fill()

  // Attendee Info Section
  currentY += 75
  ctx.textAlign = 'left'

  // Left column: Attendee Name
  ctx.font = '600 20px "Manrope", sans-serif'
  ctx.fillStyle = '#8E8E93'
  ctx.fillText('PASS HOLDER / GUEST', cardX + 70, currentY)
  ctx.font = 'bold 32px "Manrope", sans-serif'
  ctx.fillStyle = '#111111'
  ctx.fillText(info.attendeeName || 'Guest', cardX + 70, currentY + 42)

  // Right column: Status & Amount
  ctx.textAlign = 'right'
  ctx.font = '600 20px "Manrope", sans-serif'
  ctx.fillStyle = '#8E8E93'
  ctx.fillText(info.type === 'ticket' ? 'ADMISSION STATUS' : 'REGISTRATION', cardX + cardW - 70, currentY)
  ctx.font = 'bold 32px "Manrope", sans-serif'
  ctx.fillStyle = '#C81E2C'
  const statusLabel = info.type === 'ticket'
    ? (info.amount !== undefined && info.amount !== null
        ? `${formatGHS(info.amount)}${info.quantity && info.quantity > 1 ? ` (${info.quantity}x)` : ''}`
        : 'Paid Ticket')
    : 'Confirmed RSVP'
  ctx.fillText(statusLabel, cardX + cardW - 70, currentY + 42)

  // QR Code Area
  currentY += 120
  const qrBoxSize = 420
  const qrBoxX = (width - qrBoxSize) / 2
  const qrBoxY = currentY

  // QR background box
  ctx.fillStyle = '#FAFAFA'
  roundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 24)
  ctx.fill()
  ctx.strokeStyle = '#E5E7EB'
  ctx.lineWidth = 2
  ctx.stroke()

  // Draw QR code
  if (qrCanvasElement) {
    const qrInnerMargin = 28
    const qrInnerSize = qrBoxSize - qrInnerMargin * 2
    ctx.drawImage(
      qrCanvasElement,
      qrBoxX + qrInnerMargin,
      qrBoxY + qrInnerMargin,
      qrInnerSize,
      qrInnerSize
    )
  }

  // Code Display
  currentY = qrBoxY + qrBoxSize + 55
  ctx.textAlign = 'center'
  ctx.font = '600 22px "Manrope", sans-serif'
  ctx.fillStyle = '#6B6B6B'
  ctx.fillText('ENTRY VERIFICATION CODE', width / 2, currentY)

  currentY += 46
  ctx.font = 'bold 44px "Courier New", monospace'
  ctx.fillStyle = '#111111'
  ctx.fillText(info.code, width / 2, currentY)

  // Subtext
  currentY += 56
  ctx.font = '500 22px "Manrope", sans-serif'
  ctx.fillStyle = '#8E8E93'
  ctx.fillText('Present this receipt or scan QR code at venue check-in.', width / 2, currentY)

  return canvas
}

export function generateAndDownloadReceipt(
  info: ReceiptInfo,
  qrCanvasElement?: HTMLCanvasElement | null
) {
  const canvas = renderReceiptCanvas(info, qrCanvasElement)
  if (!canvas) return
  const link = document.createElement('a')
  link.download = `${info.code || 'event'}-ticket-receipt.png`
  link.href = canvas.toDataURL('image/png')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function generateAndDownloadReceiptsPdf(
  infos: ReceiptInfo[],
  qrCanvasElements: Array<HTMLCanvasElement | null>
) {
  if (infos.length === 0) return
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [1200, 1680], hotfixes: ['px_scaling'] })
  infos.forEach((info, index) => {
    if (index > 0) pdf.addPage([1200, 1680], 'portrait')
    const canvas = renderReceiptCanvas(info, qrCanvasElements[index])
    if (canvas) pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 1200, 1680)
  })
  pdf.save(`${infos[0].code || 'event'}-tickets.pdf`)
}
