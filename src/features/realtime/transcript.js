export const MAX_LIVE_TRANSCRIPT_LENGTH = 20_000
export const MAX_GESTURE_FEED_ITEMS = 10

const MAX_LEGACY_SEQUENCE_HISTORY = 256
const MAX_ANNOUNCEMENT_TEXT_LENGTH = 120
const FINISHED_FORMATTING_STATUSES = new Set([
  'completed',
  'done',
  'enhanced',
  'failed',
  'idle',
  'literal',
])

function readText(value) {
  return typeof value === 'string' ? value.trim() : undefined
}

function joinText(...parts) {
  return parts.filter(Boolean).join(' ').trim()
}

function appendText(currentText, delta) {
  return joinText(currentText, delta)
}

function takeTextTail(value, maxLength = MAX_LIVE_TRANSCRIPT_LENGTH) {
  return value.length > maxLength ? value.slice(-maxLength) : value
}

function limitConsistentParts(finalText, draftText) {
  if (!finalText) {
    const boundedDraft = takeTextTail(draftText)
    return { draftText: boundedDraft, finalText: '', fullText: boundedDraft }
  }
  if (!draftText) {
    const boundedFinal = takeTextTail(finalText)
    return { draftText: '', finalText: boundedFinal, fullText: boundedFinal }
  }

  if (draftText.length >= MAX_LIVE_TRANSCRIPT_LENGTH) {
    const boundedDraft = takeTextTail(draftText)
    return { draftText: boundedDraft, finalText: '', fullText: boundedDraft }
  }

  const finalLimit = MAX_LIVE_TRANSCRIPT_LENGTH - draftText.length - 1
  const boundedFinal = finalLimit > 0 ? takeTextTail(finalText, finalLimit) : ''
  const fullText = joinText(boundedFinal, draftText)
  return { draftText, finalText: boundedFinal, fullText }
}

function cohereTextState(finalText, draftText, fullText, messageType) {
  if (joinText(finalText, draftText) === fullText) {
    return limitConsistentParts(finalText, draftText)
  }

  const boundedFull = takeTextTail(fullText)

  if (draftText && boundedFull.endsWith(draftText)) {
    const derivedFinal = boundedFull.slice(0, -draftText.length).trimEnd()
    if (joinText(derivedFinal, draftText) === boundedFull) {
      return limitConsistentParts(derivedFinal, draftText)
    }
  }

  if (finalText && boundedFull.startsWith(finalText)) {
    const derivedDraft = boundedFull.slice(finalText.length).trimStart()
    if (joinText(finalText, derivedDraft) === boundedFull) {
      return limitConsistentParts(finalText, derivedDraft)
    }
  }

  return messageType === 'gesture' || messageType === 'formatting'
    ? { draftText: boundedFull, finalText: '', fullText: boundedFull }
    : { draftText: '', finalText: boundedFull, fullText: boundedFull }
}

function readSequence(sequence) {
  if (typeof sequence === 'number' && Number.isSafeInteger(sequence) && sequence >= 0) {
    return { key: `number:${sequence}`, kind: 'numeric', value: sequence }
  }
  if (typeof sequence === 'string' && sequence.length > 0 && sequence.length <= 128) {
    return { key: `string:${sequence}`, kind: 'legacy', value: sequence }
  }
  return null
}

function isDuplicateOrStaleGesture(sequenceHighWater, message) {
  if (message?.type !== 'gesture') return false

  const sequence = readSequence(message.sequence)
  if (!sequence) return false
  if (sequence.kind === 'numeric') {
    return sequenceHighWater.numeric !== null && sequence.value <= sequenceHighWater.numeric
  }
  return sequenceHighWater.legacySeen.includes(sequence.value)
}

function updateSequenceHighWater(sequenceHighWater, message, isDuplicateOrStale) {
  if (message?.type !== 'gesture' || isDuplicateOrStale) return sequenceHighWater

  const sequence = readSequence(message.sequence)
  if (!sequence) return sequenceHighWater
  if (sequence.kind === 'numeric') {
    return {
      ...sequenceHighWater,
      numeric:
        sequenceHighWater.numeric === null
          ? sequence.value
          : Math.max(sequenceHighWater.numeric, sequence.value),
    }
  }

  return {
    ...sequenceHighWater,
    legacy: sequence.value,
    legacySeen: [...sequenceHighWater.legacySeen, sequence.value].slice(
      -MAX_LEGACY_SEQUENCE_HISTORY,
    ),
  }
}

function readConfidence(value) {
  const confidence = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : null
}

function updateGestureFeed(gestures, message, isDuplicateOrStale) {
  if (message?.type !== 'gesture' || isDuplicateOrStale) return gestures

  const text = readText(message.text)
  if (!text) return gestures

  const sequence = readSequence(message.sequence)
  const gesture = {
    confidence: readConfidence(message.confidence),
    segmentId: message.segment_id ?? null,
    sequence: message.sequence ?? null,
    sequenceKey: sequence?.key ?? null,
    text,
  }

  return [...gestures, gesture].slice(-MAX_GESTURE_FEED_ITEMS)
}

function deriveDraftFromFullText(finalText, fullText) {
  if (!finalText) return fullText
  if (fullText === finalText) return ''
  if (fullText.startsWith(`${finalText} `)) return fullText.slice(finalText.length).trim()
  return ''
}

function applyTextSnapshots(state, message) {
  const messageType = typeof message?.type === 'string' ? message.type : 'transcript'
  const fullSnapshot = readText(message?.full_text)
  const finalSnapshot = readText(message?.final_text)
  const draftSnapshot = readText(message?.draft_text)
  const delta = readText(message?.text)
  const hasFullSnapshot = typeof fullSnapshot === 'string'
  const hasFinalSnapshot = typeof finalSnapshot === 'string'
  const hasDraftSnapshot = typeof draftSnapshot === 'string'

  let finalText = hasFinalSnapshot ? finalSnapshot : state.finalText
  let draftText = hasDraftSnapshot ? draftSnapshot : state.draftText
  let fullText = state.fullText

  if (hasFullSnapshot) {
    fullText = fullSnapshot
  } else if (hasFinalSnapshot || hasDraftSnapshot) {
    fullText = joinText(finalText, draftText)
  } else if (messageType === 'gesture' && delta) {
    draftText = appendText(draftText, delta)
    fullText = joinText(finalText, draftText)
  } else if (messageType === 'transcript' && delta) {
    fullText = appendText(fullText, delta)
  }

  if (!hasFinalSnapshot && !hasDraftSnapshot && hasFullSnapshot) {
    if (messageType === 'gesture' || messageType === 'formatting') {
      draftText = deriveDraftFromFullText(finalText, fullText)
    } else if (messageType === 'transcript') {
      finalText = fullText
      draftText = ''
    }
  } else if (messageType === 'transcript' && !hasFinalSnapshot && !hasDraftSnapshot) {
    finalText = fullText
    draftText = ''
  }

  return cohereTextState(finalText, draftText, fullText, messageType)
}

function updateFormatting(formatting, message) {
  const messageType = typeof message?.type === 'string' ? message.type : 'transcript'
  const status = typeof message?.status === 'string' ? message.status : ''
  let nextFormatting = formatting

  if (messageType === 'formatting') {
    nextFormatting = {
      active: !FINISHED_FORMATTING_STATUSES.has(status || 'formatting'),
      segmentId: message.segment_id ?? formatting.segmentId,
      status: status || 'formatting',
    }
  } else if (messageType === 'transcript') {
    const sameSegment =
      message.segment_id == null ||
      formatting.segmentId == null ||
      message.segment_id === formatting.segmentId

    if (sameSegment) {
      nextFormatting = {
        active: false,
        segmentId: message.segment_id ?? formatting.segmentId,
        status:
          status ||
          (message.enhanced === true || message.status === 'enhanced' ? 'enhanced' : 'literal'),
      }
    }
  }

  return nextFormatting.active === formatting.active &&
    nextFormatting.segmentId === formatting.segmentId &&
    nextFormatting.status === formatting.status
    ? formatting
    : nextFormatting
}

function getFinalKind(previousKind, message) {
  if (message?.type !== 'transcript') return previousKind

  const nextKind =
    message.enhanced === true || message.status === 'enhanced' ? 'enhanced' : 'literal'
  if (previousKind === 'empty' || previousKind === nextKind) return nextKind
  return 'mixed'
}

function readAnnouncementSequence(message) {
  const candidate = message?.sequence ?? message?.last_sequence ?? message?.first_sequence
  return readSequence(candidate)?.value ?? null
}

function announcementSuffix(message) {
  const sequence = readAnnouncementSequence(message)
  return sequence === null ? '' : ` до жеста ${String(sequence)}`
}

function announcementText(message) {
  const text = readText(message?.text) || ''
  return text.length > MAX_ANNOUNCEMENT_TEXT_LENGTH
    ? `${text.slice(0, MAX_ANNOUNCEMENT_TEXT_LENGTH - 1)}…`
    : text
}

export function getLiveMessageAnnouncement(message) {
  if (message?.type === 'gesture') {
    const sequence = readAnnouncementSequence(message)
    const prefix = sequence === null ? 'Жест' : `Жест ${String(sequence)}`
    const text = announcementText(message)
    return text ? `${prefix}: ${text}` : prefix
  }
  if (message?.type === 'formatting') {
    return `ИИ оформляет фразу${announcementSuffix(message)}.`
  }
  if (message?.type === 'transcript') {
    const text = announcementText(message)
    const status =
      message.enhanced === true || message.status === 'enhanced'
        ? 'Фраза оформлена'
        : 'Фраза сохранена дословно'
    return text
      ? `${status}${announcementSuffix(message)}: ${text}`
      : `${status}${announcementSuffix(message)}.`
  }
  return ''
}

export function shouldAnnounceLiveMessage(previousState, nextState, message) {
  if (message?.type === 'gesture') return nextState.gestures !== previousState.gestures
  if (message?.type === 'formatting') {
    return nextState.formatting !== previousState.formatting
  }
  if (message?.type === 'transcript') {
    return (
      nextState.revision > previousState.revision ||
      nextState.finalKind !== previousState.finalKind ||
      nextState.formatting !== previousState.formatting
    )
  }
  return false
}

export function createLiveTranscriptState() {
  return {
    draftText: '',
    finalKind: 'empty',
    finalText: '',
    formatting: {
      active: false,
      segmentId: null,
      status: 'idle',
    },
    fullText: '',
    gestures: [],
    literalText: '',
    revision: 0,
    sequenceHighWater: {
      legacy: null,
      legacySeen: [],
      numeric: null,
    },
    truncated: false,
  }
}

export function reduceLiveTranscript(state, message) {
  if (!message || typeof message !== 'object') return state

  const duplicateOrStaleGesture = isDuplicateOrStaleGesture(state.sequenceHighWater, message)
  if (duplicateOrStaleGesture) return state

  const textState = applyTextSnapshots(state, message)
  const literalSnapshot = readText(message.literal_text)
  const literalText =
    typeof literalSnapshot === 'string' ? takeTextTail(literalSnapshot) : state.literalText
  const truncated = state.truncated || message.truncated === true
  const gestures = updateGestureFeed(state.gestures, message, duplicateOrStaleGesture)
  const formatting = updateFormatting(state.formatting, message)
  const finalKind = getFinalKind(state.finalKind, message)
  const sequenceHighWater = updateSequenceHighWater(
    state.sequenceHighWater,
    message,
    duplicateOrStaleGesture,
  )
  const isTranscriptRevision =
    message.type === 'transcript' &&
    (textState.fullText !== state.fullText ||
      textState.finalText !== state.finalText ||
      textState.draftText !== state.draftText)
  const revision = isTranscriptRevision ? state.revision + 1 : state.revision

  if (
    textState.fullText === state.fullText &&
    textState.finalText === state.finalText &&
    textState.draftText === state.draftText &&
    gestures === state.gestures &&
    formatting === state.formatting &&
    finalKind === state.finalKind &&
    sequenceHighWater === state.sequenceHighWater &&
    literalText === state.literalText &&
    truncated === state.truncated &&
    revision === state.revision
  ) {
    return state
  }

  return {
    ...state,
    ...textState,
    finalKind,
    formatting,
    gestures,
    literalText,
    revision,
    sequenceHighWater,
    truncated,
  }
}
