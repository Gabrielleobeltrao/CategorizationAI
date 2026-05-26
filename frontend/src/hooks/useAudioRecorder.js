import { useCallback, useEffect, useRef, useState } from "react"

// MediaRecorder MIME preference list. Browsers vary in what they support, so
// we try opus first (smallest), fall back to plain webm/mp4.
const MIME_CANDIDATES = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg",
]

function pickSupportedMime() {
    if (typeof MediaRecorder === "undefined") return ""
    for (const mime of MIME_CANDIDATES) {
        try {
            if (MediaRecorder.isTypeSupported(mime)) return mime
        } catch {
            /* ignore */
        }
    }
    return ""
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(String(reader.result || ""))
        reader.onerror = () => reject(reader.error || new Error("Failed to read blob"))
        reader.readAsDataURL(blob)
    })
}

export default function useAudioRecorder({ maxDurationSec = 45 } = {}) {
    const [isRecording, setIsRecording] = useState(false)
    const [elapsedMs, setElapsedMs] = useState(0)
    const [error, setError] = useState(null)
    const mediaRecorderRef = useRef(null)
    const chunksRef = useRef([])
    const streamRef = useRef(null)
    const startedAtRef = useRef(0)
    const timerRef = useRef(null)
    const resolveRef = useRef(null)
    const cancelledRef = useRef(false)

    const cleanup = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
        }
        if (streamRef.current) {
            for (const track of streamRef.current.getTracks()) track.stop()
            streamRef.current = null
        }
        mediaRecorderRef.current = null
        chunksRef.current = []
        startedAtRef.current = 0
        resolveRef.current = null
        cancelledRef.current = false
        setElapsedMs(0)
        setIsRecording(false)
    }, [])

    useEffect(() => () => cleanup(), [cleanup])

    const start = useCallback(async () => {
        setError(null)
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
            setError("Recording is not supported in this browser")
            throw new Error("Recording is not supported in this browser")
        }
        const mimeType = pickSupportedMime()
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            streamRef.current = stream
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
            mediaRecorderRef.current = recorder
            chunksRef.current = []
            recorder.addEventListener("dataavailable", (event) => {
                if (event.data && event.data.size > 0) chunksRef.current.push(event.data)
            })
            recorder.addEventListener("stop", async () => {
                try {
                    if (cancelledRef.current) {
                        cleanup()
                        return
                    }
                    const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" })
                    const durationSec = Math.round((Date.now() - startedAtRef.current) / 1000)
                    const dataUrl = await blobToDataUrl(blob)
                    const resolve = resolveRef.current
                    cleanup()
                    if (resolve) {
                        resolve({
                            dataUrl,
                            duration: durationSec,
                            mimeType: blob.type || mimeType || "audio/webm",
                        })
                    }
                } catch (err) {
                    setError(err?.message || "Failed to finalize recording")
                    cleanup()
                }
            })
            startedAtRef.current = Date.now()
            recorder.start()
            setIsRecording(true)
            setElapsedMs(0)
            timerRef.current = setInterval(() => {
                const elapsed = Date.now() - startedAtRef.current
                setElapsedMs(elapsed)
                if (elapsed >= maxDurationSec * 1000) {
                    // Auto-stop when we hit the cap; consumer will receive
                    // the result via whatever promise is currently pending.
                    try {
                        recorder.stop()
                    } catch {
                        /* ignore */
                    }
                }
            }, 250)
        } catch (err) {
            setError(err?.message || "Microphone access denied")
            cleanup()
            throw err
        }
    }, [cleanup, maxDurationSec])

    // Stop and resolve with the audio result.
    const stopAndCapture = useCallback(() => {
        const recorder = mediaRecorderRef.current
        if (!recorder) return Promise.resolve(null)
        return new Promise((resolve) => {
            resolveRef.current = resolve
            cancelledRef.current = false
            try {
                recorder.stop()
            } catch {
                cleanup()
                resolve(null)
            }
        })
    }, [cleanup])

    const cancel = useCallback(() => {
        const recorder = mediaRecorderRef.current
        cancelledRef.current = true
        if (recorder && recorder.state !== "inactive") {
            try {
                recorder.stop()
            } catch {
                cleanup()
            }
        } else {
            cleanup()
        }
    }, [cleanup])

    return {
        isRecording,
        elapsedMs,
        elapsedSec: Math.floor(elapsedMs / 1000),
        error,
        start,
        stopAndCapture,
        cancel,
        maxDurationSec,
    }
}
