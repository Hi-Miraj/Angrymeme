"use client"

import React from "react"
import Head from "next/head"

import { useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  Upload,
  Brush,
  Download,
  MousePointer,
  RotateCcw,
  RotateCw,
  Trash2,
  Type,
  Clipboard,
  Github,
} from "lucide-react"

interface TextBox {
  id: string
  text: string
  x: number
  y: number
  fontSize: number
  fontFamily: string
  color: string
  strokeColor: string
  strokeWidth: number
  isDragging: boolean
}

interface DrawStroke {
  points: { x: number; y: number }[]
  color: string
  size: number
}

interface MemeInstance {
  id: string
  x: number
  y: number
  width: number
  height: number
  image: HTMLImageElement
  textBoxes: TextBox[]
  drawStrokes: DrawStroke[]
  selectedTextBox: string | null
  isDragging: boolean
  isResizing: boolean
  resizeHandle: string | null
}

interface FloatingText {
  id: string
  text: string
  x: number
  y: number
  fontSize: number
  fontFamily: string
  color: string
  strokeColor: string
  strokeWidth: number
  isDragging: boolean
  width: number
  height: number
  lines: string[]
  rotation: number
  isResizing: boolean
  isRotating: boolean
  resizeHandle: string | null
}

// Angry Eyebrow Logo Component
const AngryEyebrowLogo = ({ size = 32, className = "" }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    className={className}
    style={{ filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))" }}
  >
    <defs>
      <linearGradient id="eyebrowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1f2937" />
        <stop offset="50%" stopColor="#374151" />
        <stop offset="100%" stopColor="#111827" />
      </linearGradient>
    </defs>

    {/* Left angry eyebrow - thick and angled */}
    <path d="M4 12 L14 8 L15 10 L6 14 Z" fill="url(#eyebrowGradient)" stroke="#000000" strokeWidth="0.5" />

    {/* Right angry eyebrow - thick and angled */}
    <path d="M28 12 L18 8 L17 10 L26 14 Z" fill="url(#eyebrowGradient)" stroke="#000000" strokeWidth="0.5" />

    {/* Center connecting element - subtle angry "V" shape */}
    <path
      d="M14 10 L16 6 L18 10"
      stroke="url(#eyebrowGradient)"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    {/* Additional shadow/depth lines */}
    <path d="M5 13 L13 9.5" stroke="#000000" strokeWidth="1" opacity="0.3" />
    <path d="M27 13 L19 9.5" stroke="#000000" strokeWidth="1" opacity="0.3" />
  </svg>
)

export default function AngryMeme() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [memeInstances, setMemeInstances] = useState<MemeInstance[]>([])
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([])
  const [selectedMeme, setSelectedMeme] = useState<string | null>(null)
  const [selectedFloatingText, setSelectedFloatingText] = useState<string | null>(null)
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([])
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const [rotationStart, setRotationStart] = useState({ x: 0, y: 0, rotation: 0 })
  const [activeTool, setActiveTool] = useState<string>("select")
  const [drawColor, setDrawColor] = useState("#ffffff")
  const [drawSize, setDrawSize] = useState(3)
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [copiedElement, setCopiedElement] = useState<FloatingText | MemeInstance | null>(null)

  // Text popup state - with stroke options
  const [showTextPopup, setShowTextPopup] = useState(false)
  const [textInput, setTextInput] = useState("")
  const [textFont, setTextFont] = useState("Arial")
  const [textColor, setTextColor] = useState("#ffffff")
  const [textStrokeColor, setTextStrokeColor] = useState("#000000")
  const [textStrokeWidth, setTextStrokeWidth] = useState(2)
  const [textSize, setTextSize] = useState(32)

  // --- Selection Rectangle State ---
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{x: number, y: number} | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{x: number, y: number} | null>(null);
  const [selectedElements, setSelectedElements] = useState<{ memes: string[], texts: string[] }>({ memes: [], texts: [] });

  // Add state to track group drag offset
  const [groupDragStart, setGroupDragStart] = useState<{x: number, y: number} | null>(null);

  // Add state for pan mode
  const [isPanMode, setIsPanMode] = useState(false);

  // Add state for pan drag
  const [isPanningCanvas, setIsPanningCanvas] = useState(false);
  const [panDragStart, setPanDragStart] = useState<{x: number, y: number} | null>(null);
  const [panOffsetStart, setPanOffsetStart] = useState<{x: number, y: number} | null>(null);

  // Add eraser tool state
  const [eraserSize] = useState(24);

  const fontFamilies = ["Arial", "Anton", "Impact", "Comic Sans MS", "Times New Roman", "Helvetica"]

  // Function to wrap text and calculate dimensions
  // Optimization: reuse a single offscreen canvas/context for all text measurement
  const textMeasureCanvas = document.createElement("canvas")
  const textMeasureCtx = textMeasureCanvas.getContext("2d")

  const wrapText = (text: string, fontSize: number, fontFamily: string, maxWidth = 400) => {
    const ctx = textMeasureCtx
    if (!ctx) return { lines: [text], width: 0, height: fontSize }

    ctx.font = `bold ${fontSize}px ${fontFamily}`

    const words = text.split(" ")
    const lines: string[] = []
    let currentLine = ""
    let maxLineWidth = 0

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const testWidth = ctx.measureText(testLine).width

      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine)
        maxLineWidth = Math.max(maxLineWidth, ctx.measureText(currentLine).width)
        currentLine = word
      } else {
        currentLine = testLine
      }
    }

    if (currentLine) {
      lines.push(currentLine)
      maxLineWidth = Math.max(maxLineWidth, ctx.measureText(currentLine).width)
    }

    // If no wrapping occurred, use the actual text width
    if (lines.length === 1) {
      maxLineWidth = ctx.measureText(text).width
    }

    const height = lines.length * fontSize * 1.2

    return {
      lines,
      width: maxLineWidth,
      height,
    }
  }

  // Helper function to rotate a point around another point
  const rotatePoint = (px: number, py: number, cx: number, cy: number, angle: number) => {
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const dx = px - cx
    const dy = py - cy
    return {
      x: cx + dx * cos - dy * sin,
      y: cy + dx * sin + dy * cos,
    }
  }

  // Save state to history - Fixed function
  const saveToHistory = useCallback(() => {
    const state = JSON.stringify({
      memeInstances: memeInstances.map((meme) => ({
        ...meme,
        image: meme.image.src, // Store image src instead of HTMLImageElement
      })),
      floatingTexts,
    })
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1)
      newHistory.push(state)
      return newHistory
    })
    setHistoryIndex((prev) => prev + 1)
  }, [memeInstances, floatingTexts, historyIndex])

  // Undo function - Fixed
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      const prevState = JSON.parse(history[newIndex])

      // Restore memes with proper image objects
      const restoredMemes = prevState.memeInstances.map((meme: unknown) => {
        const m = meme as MemeInstance & { image: string };
        const img = new Image();
        img.src = m.image;
        return {
          id: m.id,
          x: m.x,
          y: m.y,
          width: m.width,
          height: m.height,
          image: img,
          textBoxes: m.textBoxes,
          drawStrokes: m.drawStrokes,
          selectedTextBox: m.selectedTextBox,
          isDragging: false,
          isResizing: false,
          resizeHandle: null,
        };
      });
      setMemeInstances(restoredMemes);

      setFloatingTexts(
        prevState.floatingTexts?.map((ft: FloatingText) => ({
          ...ft,
          isDragging: false,
          isResizing: false,
          isRotating: false,
          resizeHandle: null,
        })) || [],
      )

      // Clear selections
      setSelectedMeme(null)
      setSelectedFloatingText(null)
    }
  }, [historyIndex, history])

  // Redo function - Fixed
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      const nextState = JSON.parse(history[newIndex])

      // Restore memes with proper image objects
      const restoredMemes = nextState.memeInstances.map((meme: unknown) => {
        const m = meme as MemeInstance & { image: string };
        const img = new Image();
        img.src = m.image;
        return {
          id: m.id,
          x: m.x,
          y: m.y,
          width: m.width,
          height: m.height,
          image: img,
          textBoxes: m.textBoxes,
          drawStrokes: m.drawStrokes,
          selectedTextBox: m.selectedTextBox,
          isDragging: false,
          isResizing: false,
          resizeHandle: null,
        };
      });
      setMemeInstances(restoredMemes);

      setFloatingTexts(
        nextState.floatingTexts?.map((ft: FloatingText) => ({
          ...ft,
          isDragging: false,
          isResizing: false,
          isRotating: false,
          resizeHandle: null,
        })) || [],
      )

      // Clear selections
      setSelectedMeme(null)
      setSelectedFloatingText(null)
    }
  }, [historyIndex, history])

  // Initialize history with empty state
  React.useEffect(() => {
    if (history.length === 0) {
      const initialState = JSON.stringify({ memeInstances: [], floatingTexts: [] })
      setHistory([initialState])
      setHistoryIndex(0)
    }
  }, [history.length])

  // Keyboard shortcuts - Fixed dependencies
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent shortcuts when typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "z":
            e.preventDefault()
            if (e.shiftKey) {
              redo()
            } else {
              undo()
            }
            break
          case "y":
            e.preventDefault()
            redo()
            break
          case "c":
            e.preventDefault()
            copySelected()
            break
          case "v":
            e.preventDefault()
            pasteFromClipboard()
            break
        }
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault()
        deleteSelected()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [copySelected, deleteSelected, pasteFromClipboard])

  const copySelected = () => {
    if (selectedFloatingText) {
      const text = floatingTexts.find((ft) => ft.id === selectedFloatingText)
      if (text) {
        setCopiedElement({ ...text })
      }
    } else if (selectedMeme) {
      const meme = memeInstances.find((m) => m.id === selectedMeme)
      if (meme) {
        setCopiedElement({ ...meme })
      }
    }
  }

  const pasteFromClipboard = async () => {
    try {
      // Try to paste from system clipboard first
      const clipboardItems = await navigator.clipboard.read()
      for (const clipboardItem of clipboardItems) {
        for (const type of clipboardItem.types) {
          if (type.startsWith("image/")) {
            const blob = await clipboardItem.getType(type)
            const reader = new FileReader()
            reader.onload = (e) => {
              const img = new Image()
              img.onload = () => {
                const aspectRatio = img.width / img.height
                const maxWidth = 400
                const maxHeight = 300

                let width = maxWidth
                let height = maxWidth / aspectRatio

                if (height > maxHeight) {
                  height = maxHeight
                  width = maxHeight * aspectRatio
                }

                const newMeme: MemeInstance = {
                  id: Date.now().toString(),
                  x: Math.random() * 200,
                  y: Math.random() * 200,
                  width,
                  height,
                  image: img,
                  textBoxes: [],
                  drawStrokes: [],
                  selectedTextBox: null,
                  isDragging: false,
                  isResizing: false,
                  resizeHandle: null,
                }

                setMemeInstances((prev) => [...prev, newMeme])
                setSelectedMeme(newMeme.id)
                setTimeout(saveToHistory, 100) // Delay to ensure state is updated
              }
              img.src = e.target?.result as string
            }
            reader.readAsDataURL(blob)
            return
          }
        }
      }
    } catch (err) {
      console.log("Clipboard access failed, using copied element instead")
    }

    // Fallback to internal copied element
    if (copiedElement) {
      if ("image" in copiedElement) {
        // It's a meme
        const newMeme: MemeInstance = {
          ...copiedElement,
          id: Date.now().toString(),
          x: copiedElement.x + 20,
          y: copiedElement.y + 20,
          isDragging: false,
          isResizing: false,
          resizeHandle: null,
          selectedTextBox: null,
        }
        setMemeInstances((prev) => [...prev, newMeme])
        setSelectedMeme(newMeme.id)
      } else {
        // It's a floating text
        const newText: FloatingText = {
          ...copiedElement,
          id: Date.now().toString(),
          x: copiedElement.x + 20,
          y: copiedElement.y + 20,
          isDragging: false,
          isResizing: false,
          isRotating: false,
          resizeHandle: null,
        }
        setFloatingTexts((prev) => [...prev, newText])
        setSelectedFloatingText(newText.id)
      }
      setTimeout(saveToHistory, 100) // Delay to ensure state is updated
    }
  }

  const updateFloatingText = (textId: string, updates: Partial<FloatingText>) => {
    setFloatingTexts((prev) => prev.map((text) => (text.id === textId ? { ...text, ...updates } : text)))
  }

  // Get rotation handle for floating text
  const getTextRotationHandle = (x: number, y: number, text: FloatingText) => {
    const adjustedX = text.x + canvasOffset.x
    const adjustedY = text.y + canvasOffset.y
    const centerX = adjustedX + text.width / 2
    const centerY = adjustedY + text.height / 2
    const handleSize = 8
    const rotationHandleDistance = 30

    // Rotation handle is above the text
    const rotationHandle = rotatePoint(centerX, adjustedY - rotationHandleDistance, centerX, centerY, text.rotation)

    const distance = Math.sqrt(Math.pow(x - rotationHandle.x, 2) + Math.pow(y - rotationHandle.y, 2))

    return distance <= handleSize ? "rotate" : null
  }

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas with black background
    ctx.fillStyle = "#000000"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw each meme instance
    memeInstances.forEach((meme) => {
      const adjustedX = meme.x + canvasOffset.x
      const adjustedY = meme.y + canvasOffset.y

      // Skip if meme is outside visible area
      if (
        adjustedX + meme.width < 0 ||
        adjustedX > canvas.width ||
        adjustedY + meme.height < 0 ||
        adjustedY > canvas.height
      ) {
        return
      }

      // Draw image
      ctx.drawImage(meme.image, adjustedX, adjustedY, meme.width, meme.height)

      // Draw strokes
      meme.drawStrokes.forEach((stroke) => {
        if (stroke.points.length > 1) {
          ctx.strokeStyle = stroke.color
          ctx.lineWidth = stroke.size
          ctx.lineCap = "round"
          ctx.lineJoin = "round"
          ctx.beginPath()
          ctx.moveTo(stroke.points[0].x + adjustedX, stroke.points[0].y + adjustedY)
          for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i].x + adjustedX, stroke.points[i].y + adjustedY)
          }
          ctx.stroke()
        }
      })

      // Draw current stroke in real-time
      if (isDrawing && selectedMeme === meme.id && currentStroke.length > 1) {
        ctx.strokeStyle = drawColor
        ctx.lineWidth = drawSize
        ctx.lineCap = "round"
        ctx.lineJoin = "round"
        ctx.beginPath()
        ctx.moveTo(currentStroke[0].x + adjustedX, currentStroke[0].y + adjustedY)
        for (let i = 1; i < currentStroke.length; i++) {
          ctx.lineTo(currentStroke[i].x + adjustedX, currentStroke[i].y + adjustedY)
        }
        ctx.stroke()
      }

      // Draw text boxes on memes
      meme.textBoxes.forEach((textBox) => {
        ctx.font = `bold ${textBox.fontSize}px ${textBox.fontFamily}`
        ctx.fillStyle = textBox.color
        ctx.strokeStyle = textBox.strokeColor
        ctx.lineWidth = textBox.strokeWidth

        const lines = textBox.text.split("\n")
        lines.forEach((line, index) => {
          const x = textBox.x + adjustedX
          const y = textBox.y + adjustedY + index * textBox.fontSize * 1.2
          if (textBox.strokeWidth > 0) {
            ctx.strokeText(line, x, y)
          }
          ctx.fillText(line, x, y)
        })

        // Draw selection border for text
        if (meme.selectedTextBox === textBox.id && selectedMeme === meme.id) {
          ctx.strokeStyle = "#ffffff"
          ctx.lineWidth = 1
          ctx.setLineDash([3, 3])
          const textMetrics = ctx.measureText(textBox.text)
          ctx.strokeRect(
            textBox.x + adjustedX - 3,
            textBox.y + adjustedY - textBox.fontSize - 3,
            textMetrics.width + 6,
            textBox.fontSize + 6,
          )
          ctx.setLineDash([])
        }
      })

      // Always draw selection border and resize handles for selected meme
      if (selectedMeme === meme.id) {
        ctx.strokeStyle = "#ffffff"
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5])
        ctx.strokeRect(adjustedX - 2, adjustedY - 2, meme.width + 4, meme.height + 4)
        ctx.setLineDash([])

        // Always draw resize handles
        const handleSize = 8
        const handles = [
          { x: adjustedX - handleSize / 2, y: adjustedY - handleSize / 2 },
          { x: adjustedX + meme.width - handleSize / 2, y: adjustedY - handleSize / 2 },
          { x: adjustedX - handleSize / 2, y: adjustedY + meme.height - handleSize / 2 },
          { x: adjustedX + meme.width - handleSize / 2, y: adjustedY + meme.height - handleSize / 2 },
        ]

        ctx.fillStyle = "#ffffff"
        handles.forEach((handle) => {
          ctx.fillRect(handle.x, handle.y, handleSize, handleSize)
        })
      }
    })

    // Draw floating texts with rotation and resize handles
    floatingTexts.forEach((floatingText) => {
      const adjustedX = floatingText.x + canvasOffset.x
      const adjustedY = floatingText.y + canvasOffset.y
      const centerX = adjustedX + floatingText.width / 2
      const centerY = adjustedY + floatingText.height / 2

      ctx.save()

      // Apply rotation if needed
      if (floatingText.rotation !== 0) {
        ctx.translate(centerX, centerY)
        ctx.rotate(floatingText.rotation)
        ctx.translate(-centerX, -centerY)
      }

      ctx.font = `bold ${floatingText.fontSize}px ${floatingText.fontFamily}`
      ctx.fillStyle = floatingText.color
      ctx.strokeStyle = floatingText.strokeColor
      ctx.lineWidth = floatingText.strokeWidth

      // Draw each line of text
      floatingText.lines.forEach((line, index) => {
        const x = adjustedX
        const y = adjustedY + floatingText.fontSize + index * floatingText.fontSize * 1.2
        if (floatingText.strokeWidth > 0) {
          ctx.strokeText(line, x, y)
        }
        ctx.fillText(line, x, y)
      })

      ctx.restore()

      // Draw selection border, resize handles, and rotation handle for selected text
      if (selectedFloatingText === floatingText.id) {
        ctx.save()

        // Draw selection border (rotated)
        if (floatingText.rotation !== 0) {
          ctx.translate(centerX, centerY)
          ctx.rotate(floatingText.rotation)
          ctx.translate(-centerX, -centerY)
        }

        ctx.strokeStyle = "#ffffff"
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5])
        ctx.strokeRect(adjustedX - 5, adjustedY - 5, floatingText.width + 10, floatingText.height + 10)
        ctx.setLineDash([])

        ctx.restore()

        // Draw rotation handle (small circle above the text)
        const rotationHandleDistance = 30
        const rotationHandle = rotatePoint(
          centerX,
          adjustedY - rotationHandleDistance,
          centerX,
          centerY,
          floatingText.rotation,
        )

        ctx.fillStyle = "#00ff00"
        ctx.beginPath()
        ctx.arc(rotationHandle.x, rotationHandle.y, 6, 0, 2 * Math.PI)
        ctx.fill()

        // Draw line connecting rotation handle to text
        ctx.strokeStyle = "#ffffff"
        ctx.lineWidth = 1
        ctx.setLineDash([2, 2])
        ctx.beginPath()
        ctx.moveTo(centerX, centerY)
        ctx.lineTo(rotationHandle.x, rotationHandle.y)
        ctx.stroke()
        ctx.setLineDash([])
      }
    })
  }, [
    memeInstances,
    floatingTexts,
    canvasOffset,
    selectedMeme,
    selectedFloatingText,
    isDrawing,
    currentStroke,
    drawColor,
    drawSize,
  ])

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const aspectRatio = img.width / img.height
        const maxWidth = 400
        const maxHeight = 300

        let width = maxWidth
        let height = maxWidth / aspectRatio

        if (height > maxHeight) {
          height = maxHeight
          width = maxHeight * aspectRatio
        }

        const newMeme: MemeInstance = {
          id: Date.now().toString(),
          x: Math.random() * 200,
          y: Math.random() * 200,
          width,
          height,
          image: img,
          textBoxes: [],
          drawStrokes: [],
          selectedTextBox: null,
          isDragging: false,
          isResizing: false,
          resizeHandle: null,
        }

        setMemeInstances((prev) => [...prev, newMeme])
        setSelectedMeme(newMeme.id)
        setTimeout(saveToHistory, 100) // Delay to ensure state is updated
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const updateMeme = (memeId: string, updates: Partial<MemeInstance>) => {
    setMemeInstances((prev) => prev.map((meme) => (meme.id === memeId ? { ...meme, ...updates } : meme)))
  }

  const createFloatingText = () => {
    const canvas = canvasRef.current
    if (!canvas || !textInput.trim()) return

    // Use the wrapText function to get proper dimensions
    const { lines, width, height } = wrapText(textInput, textSize, textFont)

    const newFloatingText: FloatingText = {
      id: Date.now().toString(),
      text: textInput,
      x: canvas.width / 2 - canvasOffset.x - width / 2,
      y: canvas.height / 2 - canvasOffset.y - height / 2,
      fontSize: textSize,
      fontFamily: textFont,
      color: textColor,
      strokeColor: textStrokeColor,
      strokeWidth: textStrokeWidth,
      isDragging: false,
      width: width,
      height: height,
      lines: lines,
      rotation: 0,
      isResizing: false,
      isRotating: false,
      resizeHandle: null,
    }

    setFloatingTexts((prev) => [...prev, newFloatingText])
    setSelectedFloatingText(newFloatingText.id)
    setShowTextPopup(false)
    setTextInput("")
    setTimeout(saveToHistory, 100) // Delay to ensure state is updated
  }

  const deleteSelected = () => {
    if (selectedMeme) {
      const meme = memeInstances.find((m) => m.id === selectedMeme)
      if (meme?.selectedTextBox) {
        // Delete selected text box
        const updatedTextBoxes = meme.textBoxes.filter((tb) => tb.id !== meme.selectedTextBox)
        updateMeme(selectedMeme, { textBoxes: updatedTextBoxes, selectedTextBox: null })
        setTimeout(saveToHistory, 100)
      } else {
        // Delete entire meme
        setMemeInstances((prev) => prev.filter((m) => m.id !== selectedMeme))
        setSelectedMeme(null)
        setTimeout(saveToHistory, 100)
      }
    } else if (selectedFloatingText) {
      // Delete floating text
      setFloatingTexts((prev) => prev.filter((ft) => ft.id !== selectedFloatingText))
      setSelectedFloatingText(null)
      setTimeout(saveToHistory, 100)
    }
  }

  const getResizeHandle = (x: number, y: number, meme: MemeInstance) => {
    const adjustedX = meme.x + canvasOffset.x
    const adjustedY = meme.y + canvasOffset.y
    const handleSize = 8

    const handles = [
      { name: "tl", x: adjustedX - handleSize / 2, y: adjustedY - handleSize / 2 },
      { name: "tr", x: adjustedX + meme.width - handleSize / 2, y: adjustedY - handleSize / 2 },
      { name: "bl", x: adjustedX - handleSize / 2, y: adjustedY + meme.height - handleSize / 2 },
      { name: "br", x: adjustedX + meme.width - handleSize / 2, y: adjustedY + meme.height - handleSize / 2 },
    ]

    for (const handle of handles) {
      if (x >= handle.x && x <= handle.x + handleSize && y >= handle.y && y <= handle.y + handleSize) {
        return handle.name
      }
    }
    return null
  }

  // --- Mouse Events for Selection Rectangle ---
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanMode) {
      setIsPanningCanvas(true);
      setPanDragStart({ x: e.clientX, y: e.clientY });
      setPanOffsetStart({ ...canvasOffset });
      return;
    }
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // --- Floating Text Rotation Priority ---
    for (const ft of [...floatingTexts].reverse()) {
      if (selectedFloatingText === ft.id) {
        const handle = getTextRotationHandle(x, y, ft);
        if (handle === "rotate") {
          updateFloatingText(ft.id, { isRotating: true });
          setRotationStart({ x, y, rotation: ft.rotation });
          return;
        }
      }
    }
    if (activeTool === "select" && e.button === 0) {
      // 1. Check for meme resize handle first
      let resizeTarget: MemeInstance | null = null;
      let resizeHandle: string | null = null;
      for (const meme of [...memeInstances].reverse()) {
        const handle = getResizeHandle(x, y, meme);
        if (handle) {
          resizeTarget = meme;
          resizeHandle = handle;
          break;
        }
      }
      if (resizeTarget && resizeHandle) {
        setSelectedMeme(resizeTarget.id);
        setSelectedFloatingText(null);
        setResizeStart({ x, y, width: resizeTarget.width, height: resizeTarget.height });
        updateMeme(resizeTarget.id, { isResizing: true, resizeHandle });
        return;
      }
      // 2. Check if mouse is on any element (text first, then image)
      let onElement = false;
      let clickedMeme: MemeInstance | null = null;
      let clickedFloatingText: FloatingText | null = null;
      for (const ft of [...floatingTexts].reverse()) {
        if (x >= ft.x && x <= ft.x + ft.width && y >= ft.y && y <= ft.y + ft.height) {
          onElement = true;
          clickedFloatingText = ft;
          break;
        }
      }
      if (!onElement) {
        for (const meme of [...memeInstances].reverse()) {
          if (x >= meme.x && x <= meme.x + meme.width && y >= meme.y && y <= meme.y + meme.height) {
            onElement = true;
            clickedMeme = meme;
            break;
          }
        }
      }
      if (!onElement) {
        setIsSelecting(true);
        setSelectionStart({ x, y });
        setSelectionEnd({ x, y });
        return;
      } else {
        // If on element, trigger group drag if multiple selected
        const isGroup = (
          (clickedFloatingText && selectedElements.texts.includes(clickedFloatingText.id) && selectedElements.texts.length + selectedElements.memes.length > 1) ||
          (clickedMeme && selectedElements.memes.includes(clickedMeme.id) && selectedElements.texts.length + selectedElements.memes.length > 1)
        );
        if (isGroup) {
          setGroupDragStart({ x, y });
          setMemeInstances((prev) => prev.map(m => selectedElements.memes.includes(m.id) ? { ...m, isDragging: true } : m));
          setFloatingTexts((prev) => prev.map(ft => selectedElements.texts.includes(ft.id) ? { ...ft, isDragging: true } : ft));
          setDragOffset({ x, y });
          return;
        }
        // If only one, drag as before
        if (clickedFloatingText) {
          setSelectedFloatingText(clickedFloatingText.id);
          setSelectedMeme(null);
          updateFloatingText(clickedFloatingText.id, { isDragging: true });
          setDragOffset({ x: x - (clickedFloatingText.x + canvasOffset.x), y: y - (clickedFloatingText.y + canvasOffset.y) });
          return;
        }
        if (clickedMeme) {
          setSelectedMeme(clickedMeme.id);
          setSelectedFloatingText(null);
          updateMeme(clickedMeme.id, { isDragging: true });
          setDragOffset({ x: x - (clickedMeme.x + canvasOffset.x), y: y - (clickedMeme.y + canvasOffset.y) });
          return;
        }
      }
    }
    // --- Brush Tool Logic ---
    if (activeTool === "brush" && e.button === 0 && selectedMeme) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      // Convert to meme-local coordinates, accounting for canvasOffset
      const meme = memeInstances.find(m => m.id === selectedMeme);
      if (meme) {
        const localX = x - meme.x - canvasOffset.x;
        const localY = y - meme.y - canvasOffset.y;
        setIsDrawing(true);
        setCurrentStroke([{ x: localX, y: localY }]);
      }
      return;
    }
    // --- Eraser Tool Logic ---
    if (activeTool === "eraser" && e.button === 0 && selectedMeme) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const meme = memeInstances.find(m => m.id === selectedMeme);
      if (meme) {
        const localX = x - meme.x - canvasOffset.x;
        const localY = y - meme.y - canvasOffset.y;
        // Remove any stroke that is touched by the eraser
        const newStrokes = meme.drawStrokes.filter(stroke => !isPointNearStroke({ x: localX, y: localY }, stroke, eraserSize / 2));
        if (newStrokes.length !== meme.drawStrokes.length) {
          updateMeme(meme.id, { drawStrokes: newStrokes });
          setTimeout(saveToHistory, 100);
        }
      }
      return;
    }
    // ... existing logic for other tools ...
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanningCanvas && panDragStart && panOffsetStart) {
      const dx = e.clientX - panDragStart.x;
      const dy = e.clientY - panDragStart.y;
      setCanvasOffset({ x: panOffsetStart.x + dx, y: panOffsetStart.y + dy });
      return;
    }
    if (isPanMode) return;
    // Handle meme resizing
    const resizingMeme = memeInstances.find((m) => m.isResizing);
    if (resizingMeme) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const deltaX = x - resizeStart.x;
      const deltaY = y - resizeStart.y;
      let newWidth = resizeStart.width;
      let newHeight = resizeStart.height;
      switch (resizingMeme.resizeHandle) {
        case "br":
          newWidth = Math.max(50, resizeStart.width + deltaX);
          newHeight = Math.max(50, resizeStart.height + deltaY);
          break;
        case "bl":
          newWidth = Math.max(50, resizeStart.width - deltaX);
          newHeight = Math.max(50, resizeStart.height + deltaY);
          if (newWidth !== resizingMeme.width) {
            updateMeme(resizingMeme.id, { x: resizingMeme.x + (resizeStart.width - newWidth) });
          }
          break;
        case "tr":
          newWidth = Math.max(50, resizeStart.width + deltaX);
          newHeight = Math.max(50, resizeStart.height - deltaY);
          if (newHeight !== resizingMeme.height) {
            updateMeme(resizingMeme.id, { y: resizingMeme.y + (resizeStart.height - newHeight) });
          }
          break;
        case "tl":
          newWidth = Math.max(50, resizeStart.width - deltaX);
          newHeight = Math.max(50, resizeStart.height - deltaY);
          if (newWidth !== resizingMeme.width) {
            updateMeme(resizingMeme.id, { x: resizingMeme.x + (resizeStart.width - newWidth) });
          }
          if (newHeight !== resizingMeme.height) {
            updateMeme(resizingMeme.id, { y: resizingMeme.y + (resizeStart.height - newHeight) });
          }
          break;
      }
      updateMeme(resizingMeme.id, { width: newWidth, height: newHeight });
      return;
    }
    // Handle group drag
    if (groupDragStart) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const dx = x - dragOffset.x;
      const dy = y - dragOffset.y;
      setMemeInstances((prev) => prev.map(m => selectedElements.memes.includes(m.id) && m.isDragging ? { ...m, x: m.x + dx, y: m.y + dy } : m));
      setFloatingTexts((prev) => prev.map(ft => selectedElements.texts.includes(ft.id) && ft.isDragging ? { ...ft, x: ft.x + dx, y: ft.y + dy } : ft));
      setDragOffset({ x, y });
      return;
    }
    // Handle dragging meme
    const draggingMeme = memeInstances.find((m) => m.isDragging);
    if (draggingMeme && !groupDragStart) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      updateMeme(draggingMeme.id, {
        x: x - dragOffset.x - canvasOffset.x,
        y: y - dragOffset.y - canvasOffset.y,
      });
      return;
    }
    // Handle dragging floating text
    const draggingFloatingText = floatingTexts.find((ft) => ft.isDragging);
    if (draggingFloatingText && !groupDragStart) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      updateFloatingText(draggingFloatingText.id, {
        x: x - dragOffset.x - canvasOffset.x,
        y: y - dragOffset.y - canvasOffset.y,
      });
      return;
    }
    // Selection rectangle logic (MISSING):
    if (isSelecting) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setSelectionEnd({ x, y });
      return;
    }
    // --- Brush Tool Logic ---
    if (activeTool === "brush" && isDrawing && selectedMeme) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const meme = memeInstances.find(m => m.id === selectedMeme);
      if (meme) {
        const localX = x - meme.x - canvasOffset.x;
        const localY = y - meme.y - canvasOffset.y;
        setCurrentStroke(prev => [...prev, { x: localX, y: localY }]);
      }
      return;
    }
    // --- Floating Text Rotation ---
    const rotatingText = floatingTexts.find(ft => ft.isRotating);
    if (rotatingText) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rotatingText.x + canvasOffset.x + rotatingText.width / 2;
      const centerY = rotatingText.y + canvasOffset.y + rotatingText.height / 2;
      const startAngle = Math.atan2(rotationStart.y - centerY, rotationStart.x - centerX);
      const currentAngle = Math.atan2(y - centerY, x - centerX);
      const delta = currentAngle - startAngle;
      updateFloatingText(rotatingText.id, { rotation: rotationStart.rotation + delta });
      return;
    }
    // ... existing logic for other tools ...
  };

  const handleCanvasMouseUp = () => {
    if (isPanningCanvas) {
      setIsPanningCanvas(false);
      setPanDragStart(null);
      setPanOffsetStart(null);
      return;
    }
    if (isPanMode) return;
    // Stop meme resizing
    setMemeInstances((prev) =>
      prev.map((meme) => ({ ...meme, isResizing: false, resizeHandle: null }))
    );
    if (isSelecting && selectionStart && selectionEnd) {
      // Only trigger selection if dragged more than a minimal distance
      const dx = Math.abs(selectionEnd.x - selectionStart.x);
      const dy = Math.abs(selectionEnd.y - selectionStart.y);
      if (dx < 3 && dy < 3) {
        setIsSelecting(false);
        setSelectionStart(null);
        setSelectionEnd(null);
        return;
      }
      // Calculate selection rectangle
      const x1 = Math.min(selectionStart.x, selectionEnd.x);
      const y1 = Math.min(selectionStart.y, selectionEnd.y);
      const x2 = Math.max(selectionStart.x, selectionEnd.x);
      const y2 = Math.max(selectionStart.y, selectionEnd.y);

      // Find all memes/texts that intersect the rectangle
      const selectedMemes = memeInstances
        .filter(m => !(m.x + m.width < x1 || m.x > x2 || m.y + m.height < y1 || m.y > y2))
        .map(m => m.id);
      const selectedTexts = floatingTexts
        .filter(ft => !(ft.x + ft.width < x1 || ft.x > x2 || ft.y + ft.height < y1 || ft.y > y2))
        .map(ft => ft.id);

      setSelectedElements({ memes: selectedMemes, texts: selectedTexts });
      setIsSelecting(false);
      setSelectionStart(null);
      setSelectionEnd(null);
      return;
    }
    // Stop group drag
    setGroupDragStart(null);
    setMemeInstances((prev) =>
      prev.map((meme) => ({ ...meme, isDragging: false }))
    );
    setFloatingTexts((prev) =>
      prev.map((ft) => ({ ...ft, isDragging: false }))
    );
    // --- Brush Tool Logic ---
    if (activeTool === "brush" && isDrawing && selectedMeme && currentStroke.length > 1) {
      setMemeInstances(prev => prev.map(m => m.id === selectedMeme ? {
        ...m,
        drawStrokes: [...m.drawStrokes, { points: currentStroke, color: drawColor, size: drawSize }]
      } : m));
      setIsDrawing(false);
      setCurrentStroke([]);
      setTimeout(saveToHistory, 100);
      return;
    }
    setIsDrawing(false);
    setCurrentStroke([]);
    // --- Floating Text Rotation End ---
    setFloatingTexts(prev => prev.map(ft => ft.isRotating ? { ...ft, isRotating: false } : ft));
    // ... existing logic for other tools ...
  };

  // --- Download Only Selected Elements ---
  const downloadAll = () => {
    if (selectedElements.memes.length === 0 && selectedElements.texts.length === 0) {
      alert("Select elements to download.");
      return;
    }
    // Calculate bounding box of all selected elements
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedElements.memes.forEach(id => {
      const m = memeInstances.find(m => m.id === id);
      if (m) {
        minX = Math.min(minX, m.x);
        minY = Math.min(minY, m.y);
        maxX = Math.max(maxX, m.x + m.width);
        maxY = Math.max(maxY, m.y + m.height);
      }
    });
    selectedElements.texts.forEach(id => {
      const ft = floatingTexts.find(ft => ft.id === id);
      if (ft) {
        minX = Math.min(minX, ft.x);
        minY = Math.min(minY, ft.y);
        maxX = Math.max(maxX, ft.x + ft.width);
        maxY = Math.max(maxY, ft.y + ft.height);
      }
    });
    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
      alert("Nothing to export.");
      return;
    }
    const width = Math.ceil(maxX - minX);
    const height = Math.ceil(maxY - minY);
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width;
    tempCanvas.height = height;
    const ctx = tempCanvas.getContext("2d");
    if (!ctx) return;

    // Draw selected memes (images, strokes, text boxes)
    selectedElements.memes.forEach(id => {
      const m = memeInstances.find(m => m.id === id);
      if (m) {
        ctx.drawImage(m.image, m.x - minX, m.y - minY, m.width, m.height);
        m.drawStrokes.forEach(stroke => {
          if (stroke.points.length > 1) {
            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = stroke.size;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(stroke.points[0].x + m.x - minX, stroke.points[0].y + m.y - minY);
            for (let i = 1; i < stroke.points.length; i++) {
              ctx.lineTo(stroke.points[i].x + m.x - minX, stroke.points[i].y + m.y - minY);
            }
            ctx.stroke();
          }
        });
        m.textBoxes.forEach(tb => {
          ctx.font = `bold ${tb.fontSize}px ${tb.fontFamily}`;
          ctx.fillStyle = tb.color;
          ctx.strokeStyle = tb.strokeColor;
          ctx.lineWidth = tb.strokeWidth;
          const lines = tb.text.split("\n");
          lines.forEach((line, idx) => {
            const x = tb.x + m.x - minX;
            const y = tb.y + m.y - minY + idx * tb.fontSize * 1.2;
            if (tb.strokeWidth > 0) ctx.strokeText(line, x, y);
            ctx.fillText(line, x, y);
          });
        });
      }
    });
    // Draw selected floating texts
    selectedElements.texts.forEach(id => {
      const ft = floatingTexts.find(ft => ft.id === id);
      if (ft) {
        ctx.save();
        if (ft.rotation !== 0) {
          ctx.translate(ft.x - minX + ft.width / 2, ft.y - minY + ft.height / 2);
          ctx.rotate(ft.rotation);
          ctx.translate(-ft.width / 2, -ft.height / 2);
        } else {
          ctx.translate(ft.x - minX, ft.y - minY);
        }
        ctx.font = `bold ${ft.fontSize}px ${ft.fontFamily}`;
        ctx.fillStyle = ft.color;
        ctx.strokeStyle = ft.strokeColor;
        ctx.lineWidth = ft.strokeWidth;
        ft.lines.forEach((line, idx) => {
          const x = 0;
          const y = ft.fontSize + idx * ft.fontSize * 1.2;
          if (ft.strokeWidth > 0) ctx.strokeText(line, x, y);
          ctx.fillText(line, x, y);
        });
        ctx.restore();
      }
    });

    const link = document.createElement("a");
    link.download = "meme.png";
    link.href = tempCanvas.toDataURL();
    link.click();
  };

  // Redraw canvas when state changes
  React.useEffect(() => {
    const animationFrame = requestAnimationFrame(redrawCanvas)
    return () => cancelAnimationFrame(animationFrame)
  }, [redrawCanvas])

  // Resize canvas to fill container
  React.useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) return

      canvas.width = container.clientWidth
      canvas.height = container.clientHeight
      redrawCanvas()
    }

    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)
    return () => window.removeEventListener("resize", resizeCanvas)
  }, [redrawCanvas])

  const selectedMemeData = memeInstances.find((m) => m.id === selectedMeme)
  // const selectedTextBoxData = selectedMemeData?.textBoxes.find((tb) => tb.id === selectedMemeData.selectedTextBox) || null

  // --- Eraser Tool Logic ---
  function isPointNearStroke(point: {x: number, y: number}, stroke: DrawStroke, threshold: number) {
    // Check if point is within threshold of any segment in the stroke
    for (let i = 1; i < stroke.points.length; i++) {
      const x1 = stroke.points[i - 1].x;
      const y1 = stroke.points[i - 1].y;
      const x2 = stroke.points[i].x;
      const y2 = stroke.points[i].y;
      // Closest point on segment
      const dx = x2 - x1;
      const dy = y2 - y1;
      const lengthSq = dx * dx + dy * dy;
      let t = 0;
      if (lengthSq > 0) {
        t = ((point.x - x1) * dx + (point.y - y1) * dy) / lengthSq;
        t = Math.max(0, Math.min(1, t));
      }
      const projX = x1 + t * dx;
      const projY = y1 + t * dy;
      const distSq = (point.x - projX) ** 2 + (point.y - projY) ** 2;
      if (distSq <= threshold * threshold) return true;
    }
    return false;
  }

  return (
    <>
      <Head>
        <title>Angry Meme</title>
      </Head>
      <div className="h-screen flex bg-black">
        {/* App Title with Logo - Top Left */}
        <div className="absolute top-4 left-4 z-10">
          <div className="flex items-center gap-3 bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-lg px-4 py-2 shadow-lg">
            <div>
              <h1 className="text-xl font-bold text-white tracking-wide">ANGRY MEME</h1>
              <p className="text-xs text-gray-400 opacity-80">make memes bc you are ugly</p>
            </div>
            <div className="flex items-center gap-1 ml-3">
              <Button
                onClick={() => window.open('https://github.com/Hi-Miraj/Angrymeme', '_blank')}
                variant="ghost"
                size="sm"
                className="w-8 h-8 p-0 text-white bg-black rounded-full"
                title="View on GitHub"
                style={{ boxShadow: 'none', border: 'none' }}
              >
                <Github className="w-5 h-5" />
              </Button>
              <Button
                onClick={() => window.open('https://x.com/MirajShafek', '_blank')}
                variant="ghost"
                size="sm"
                className="w-8 h-8 p-0 text-white bg-black rounded-full transition duration-200 hover:bg-white group"
                title="Follow on X"
                style={{ boxShadow: 'none', border: 'none' }}
              >
                {/* Official X logo SVG, black and white, as used on x.com */}
                <svg width="20" height="20" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 15L105 105M105 15L15 105" stroke="currentColor" strokeWidth="16" strokeLinecap="round" className="transition-colors duration-200 group-hover:stroke-black" />
                </svg>
              </Button>
            </div>
          </div>
        </div>

        {/* Simplified Toolbar */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-black/90 backdrop-blur-sm border border-gray-600 rounded-lg p-2 shadow-lg">
            <div className="flex items-center gap-1">
              <Button
                onClick={() => setActiveTool("select")}
                variant={activeTool === "select" ? "default" : "ghost"}
                size="sm"
                className={`w-8 h-8 p-0 bg-transparent hover:bg-gray-800 text-white${activeTool === "select" ? " ring-2 ring-cyan-400 ring-offset-2 ring-offset-black" : ""}`}
                title="Select Tool"
              >
                <MousePointer className="w-4 h-4" />
              </Button>

              <Button
                onClick={() => setActiveTool("brush")}
                variant={activeTool === "brush" ? "default" : "ghost"}
                size="sm"
                className={`w-8 h-8 p-0 bg-transparent hover:bg-gray-800 text-white${activeTool === "brush" ? " ring-2 ring-cyan-400 ring-offset-2 ring-offset-black" : ""}`}
                title="Brush Tool"
              >
                <Brush className="w-4 h-4" />
              </Button>

              {activeTool === "brush" && (
                <>
                  <input
                    type="color"
                    value={drawColor}
                    onChange={e => setDrawColor(e.target.value)}
                    style={{ marginLeft: 8, marginRight: 4, width: 32, height: 32, border: '2px solid #0ff', background: '#222', cursor: 'pointer' }}
                    title="Brush Color"
                  />
                  <input
                    type="range"
                    min={1}
                    max={40}
                    value={drawSize}
                    onChange={e => setDrawSize(Number(e.target.value))}
                    style={{ marginLeft: 4, marginRight: 4, verticalAlign: 'middle' }}
                    title="Brush Size"
                  />
                  <span style={{ color: '#fff', fontSize: 14, marginRight: 8 }}>{drawSize}px</span>
                </>
              )}

              <div className="w-px h-6 bg-gray-600 mx-1" />

              <Button
                onClick={undo}
                variant="ghost"
                size="sm"
                className="w-8 h-8 p-0 bg-transparent hover:bg-gray-800 text-white"
                title="Undo (Ctrl+Z)"
                disabled={historyIndex <= 0}
              >
                <RotateCcw className="w-4 h-4" />
              </Button>

              <Button
                onClick={redo}
                variant="ghost"
                size="sm"
                className="w-8 h-8 p-0 bg-transparent hover:bg-gray-800 text-white"
                title="Redo (Ctrl+Y)"
                disabled={historyIndex >= history.length - 1}
              >
                <RotateCw className="w-4 h-4" />
              </Button>

              <div className="w-px h-6 bg-gray-600 mx-1" />

              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="ghost"
                size="sm"
                className="w-8 h-8 p-0 bg-transparent hover:bg-gray-800 text-white"
                title="Upload Image"
              >
                <Upload className="w-4 h-4" />
              </Button>

              <Button
                onClick={pasteFromClipboard}
                variant="ghost"
                size="sm"
                className="w-8 h-8 p-0 bg-transparent hover:bg-gray-800 text-white"
                title="Paste (Ctrl+V)"
              >
                <Clipboard className="w-4 h-4" />
              </Button>

              <Button
                onClick={downloadAll}
                variant="ghost"
                size="sm"
                className="w-8 h-8 p-0 bg-transparent hover:bg-gray-800 text-white"
                title="Download Canvas"
              >
                <Download className="w-4 h-4" />
              </Button>

              <Button
                onClick={deleteSelected}
                variant="ghost"
                size="sm"
                className="w-8 h-8 p-0 bg-transparent hover:bg-gray-800 text-white"
                title="Delete Selected (Delete)"
              >
                <Trash2 className="w-4 h-4" />
              </Button>

              <Button
                onClick={() => setActiveTool("eraser")}
                variant={activeTool === "eraser" ? "default" : "ghost"}
                size="sm"
                className={`w-8 h-8 p-0 bg-transparent hover:bg-gray-800 text-white${activeTool === "eraser" ? " ring-2 ring-cyan-400 ring-offset-2 ring-offset-black" : ""}`}
                title="Eraser Tool"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="13" width="10" height="4" rx="1" fill="#fff" stroke="#0ff" strokeWidth="2"/><rect x="7" y="3" width="10" height="10" rx="2" fill="#0ff" stroke="#fff" strokeWidth="2"/></svg>
              </Button>
            </div>
          </div>
        </div>

        {/* Text Menu Button - Lower Left */}
        <div className="absolute bottom-4 left-4 z-10">
          <Button
            onClick={() => setShowTextPopup(true)}
            className="bg-gray-900/90 backdrop-blur-sm border border-gray-700 text-white hover:bg-gray-800/90 px-4 py-2 shadow-lg"
          >
            <Type className="w-4 h-4 mr-2" />
            text menu
          </Button>
        </div>

        {/* Compact Text Creation Popup - Lower Left */}
        {showTextPopup && (
          <div className="absolute bottom-16 left-4 z-50">
            <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg p-4 w-80 shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <AngryEyebrowLogo size={20} />
                  <h3 className="text-lg font-bold text-white">Add Text</h3>
                </div>
                <Button
                  onClick={() => {
                    setShowTextPopup(false)
                    setTextInput("")
                  }}
                  variant="ghost"
                  size="sm"
                  className="bg-gray-800/50 text-white hover:bg-gray-700/50 px-2 py-1 rounded text-xs"
                >
                  ×
                </Button>
              </div>

              <div className="space-y-3">
                {/* Text Input */}
                <div>
                  <textarea
                    value={textInput}
                    onChange={(e) => {
                      setTextInput(e.target.value)
                    }}
                    className="w-full h-20 p-2 bg-gray-800/90 text-white border border-gray-600 rounded resize-none focus:border-gray-500 focus:outline-none text-sm"
                    placeholder="Enter your text here..."
                    style={{
                      fontFamily: textFont,
                      fontSize: "14px",
                      color: textColor,
                    }}
                  />
                </div>

                {/* Live Visualizer */}
                <div
                  className="w-full min-h-[40px] p-2 border border-dashed border-fuchsia-500 bg-gray-950 text-center mb-2"
                  style={{
                    fontFamily: textFont,
                    fontSize: textSize + "px",
                    color: textColor,
                    WebkitTextStroke: textStrokeWidth > 0 ? `${textStrokeWidth}px ${textStrokeColor}` : undefined,
                    textShadow: textStrokeWidth > 0 ? `0 0 1px ${textStrokeColor}` : undefined,
                    whiteSpace: "pre-line",
                    overflowWrap: "break-word",
                    wordBreak: "break-word",
                    marginBottom: 8,
                    pointerEvents: "none",
                    userSelect: "none",
                  }}
                >
                  {textInput || <span className="text-gray-600">Live preview…</span>}
                </div>

                {/* Font and Size Row */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-white text-xs font-medium mb-1">Font</label>
                    <select
                      value={textFont}
                      onChange={(e) => {
                        setTextFont(e.target.value)
                      }}
                      className="w-full p-2 bg-gray-800/90 text-white rounded border border-gray-600 focus:border-gray-500 focus:outline-none text-sm"
                    >
                      {fontFamilies.map((font) => (
                        <option key={font} value={font}>
                          {font}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-20">
                    <label className="block text-white text-xs font-medium mb-1">Size</label>
                    <input
                      type="number"
                      min="12"
                      max="72"
                      value={textSize}
                      onChange={(e) => {
                        setTextSize(Number.parseInt(e.target.value))
                      }}
                      className="w-full p-2 bg-gray-800/90 text-white rounded border border-gray-600 focus:border-gray-500 focus:outline-none text-sm"
                    />
                  </div>
                </div>

                {/* Colors Row */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-white text-xs font-medium mb-1">Text Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={textColor}
                        onChange={(e) => {
                          setTextColor(e.target.value)
                        }}
                        className="w-8 h-8 rounded border border-gray-600 bg-gray-800"
                      />
                      <span className="text-gray-300 text-xs">{textColor}</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="block text-white text-xs font-medium mb-1">Stroke</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={textStrokeColor}
                        onChange={(e) => {
                          setTextStrokeColor(e.target.value)
                        }}
                        className="w-8 h-8 rounded border border-gray-600 bg-gray-800"
                      />
                      <input
                        type="range"
                        min="0"
                        max="10"
                        value={textStrokeWidth}
                        onChange={(e) => {
                          setTextStrokeWidth(Number.parseInt(e.target.value))
                        }}
                        className="flex-1"
                      />
                      <span className="text-white text-xs w-6">{textStrokeWidth}</span>
                    </div>
                  </div>
                </div>

                {/* Create/Update Button */}
                <Button
                  onClick={createFloatingText}
                  disabled={!textInput.trim()}
                  className="w-full bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-white font-medium py-2 rounded text-sm shadow-lg"
                >
                  Add Text
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Canvas Container */}
        <div
          ref={containerRef}
          className="h-screen w-full bg-black relative overflow-hidden"
          tabIndex={0}
          onWheel={e => {
            if (e.ctrlKey) {
              e.preventDefault();
              setCanvasOffset(prev => ({ x: prev.x, y: prev.y - e.deltaY }));
            }
          }}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 cursor-crosshair"
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
          />

          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />

          {/* Draw selection rectangle */}
          {isSelecting && selectionStart && selectionEnd && (
            <div
              style={{
                position: 'absolute',
                left: Math.min(selectionStart.x, selectionEnd.x),
                top: Math.min(selectionStart.y, selectionEnd.y),
                width: Math.abs(selectionEnd.x - selectionStart.x),
                height: Math.abs(selectionEnd.y - selectionStart.y),
                border: '2px dashed #0ff',
                background: 'rgba(0,255,255,0.1)',
                zIndex: 1000,
                pointerEvents: 'none',
              }}
            />
          )}

          {/* Drag/Pan Toggle Icon at bottom right */}
          <button
            onClick={() => setIsPanMode(p => !p)}
            style={{
              position: 'absolute',
              right: 24,
              bottom: 24,
              zIndex: 20,
              width: 48,
              height: 48,
              borderRadius: 24,
              background: isPanMode ? '#0ff' : '#222',
              border: '2px solid #0ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px #000a',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            title={isPanMode ? 'Pan Mode (click to return to select)' : 'Select Mode (click to pan)'}
          >
            {/* Simple drag icon (SVG) */}
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="13" stroke="#0ff" strokeWidth="2" fill={isPanMode ? '#0ff' : 'none'} />
              <rect x="8" y="13" width="12" height="2" rx="1" fill="#0ff" />
              <rect x="13" y="8" width="2" height="12" rx="1" fill="#0ff" />
            </svg>
          </button>
        </div>

        {/* Status Bar */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <div className="bg-black/90 backdrop-blur-sm border border-gray-600 rounded-lg px-3 py-1 shadow-lg">
            <span className="text-white text-xs">
              {memeInstances.length} meme{memeInstances.length !== 1 ? "s" : ""} • {floatingTexts.length} text
              {floatingTexts.length !== 1 ? "s" : ""} • {activeTool} tool
            </span>
          </div>
        </div>

        {/* Add a new div in the top-right for upload/download, visually distinct */}
        <div className="absolute top-4 right-4 z-20">
          <div className="flex items-center gap-2 bg-gray-900/90 backdrop-blur-sm border border-cyan-400 rounded-lg px-4 py-2 shadow-lg">
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="ghost"
              size="sm"
              className="w-8 h-8 p-0 text-cyan-400 hover:bg-gray-800"
              title="Upload Image"
            >
              <Upload className="w-5 h-5" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImageUpload}
            />
            <Button
              onClick={downloadAll}
              variant="ghost"
              size="sm"
              className="w-8 h-8 p-0 text-cyan-400 hover:bg-gray-800"
              title="Download Selected"
            >
              <Download className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
