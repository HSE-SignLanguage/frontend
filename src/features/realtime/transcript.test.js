import { describe, expect, it } from 'vitest'

import {
  MAX_GESTURE_FEED_ITEMS,
  MAX_LIVE_TRANSCRIPT_LENGTH,
  createLiveTranscriptState,
  getLiveMessageAnnouncement,
  reduceLiveTranscript,
  shouldAnnounceLiveMessage,
} from './transcript'

function reduceMessages(messages) {
  return messages.reduce(reduceLiveTranscript, createLiveTranscriptState())
}

describe('live transcript reducer', () => {
  it('keeps authoritative snapshots and separate final and draft text', () => {
    const state = reduceMessages([
      {
        type: 'gesture',
        text: 'привет',
        full_text: 'привет',
        final_text: '',
        draft_text: 'привет',
        sequence: 1,
        status: 'draft',
      },
      {
        type: 'gesture',
        text: 'мир',
        full_text: 'привет мир',
        final_text: '',
        draft_text: 'привет мир',
        sequence: 2,
        status: 'draft',
      },
    ])

    expect(state.fullText).toBe('привет мир')
    expect(state.finalText).toBe('')
    expect(state.draftText).toBe('привет мир')
    expect(state.revision).toBe(0)
  })

  it('deduplicates gesture sequences and bounds the raw feed', () => {
    const messages = Array.from({ length: MAX_GESTURE_FEED_ITEMS + 3 }, (_, index) => ({
      type: 'gesture',
      text: `жест-${index}`,
      sequence: index,
      confidence: 0.8,
    }))
    messages.splice(2, 0, { type: 'gesture', text: 'дубль', sequence: 1 })

    const state = reduceMessages(messages)

    expect(state.gestures).toHaveLength(MAX_GESTURE_FEED_ITEMS)
    expect(state.gestures.map((gesture) => gesture.sequence)).toEqual(
      Array.from({ length: MAX_GESTURE_FEED_ITEMS }, (_, index) => index + 3),
    )
  })

  it('does not append a duplicate gesture delta without a snapshot', () => {
    const state = reduceMessages([
      { type: 'gesture', text: 'день', sequence: 4 },
      { type: 'gesture', text: 'день', sequence: 4 },
    ])

    expect(state.fullText).toBe('день')
    expect(state.draftText).toBe('день')
    expect(state.gestures).toHaveLength(1)
  })

  it('keeps numeric sequence high-water after an item leaves the feed', () => {
    const initial = reduceMessages(
      Array.from({ length: MAX_GESTURE_FEED_ITEMS + 4 }, (_, index) => ({
        type: 'gesture',
        text: `жест-${index + 1}`,
        sequence: index + 1,
      })),
    )
    const replayed = reduceLiveTranscript(initial, {
      type: 'gesture',
      text: 'жест-1',
      sequence: 1,
    })

    expect(initial.sequenceHighWater.numeric).toBe(MAX_GESTURE_FEED_ITEMS + 4)
    expect(initial.gestures.some((gesture) => gesture.sequence === 1)).toBe(false)
    expect(replayed).toBe(initial)
  })

  it('does not let a stale gesture snapshot roll authoritative text back', () => {
    const current = reduceMessages([
      { type: 'gesture', text: 'привет', full_text: 'привет', sequence: 1 },
      { type: 'gesture', text: 'мир', full_text: 'привет мир', sequence: 2 },
    ])
    const stale = reduceLiveTranscript(current, {
      type: 'gesture',
      text: 'привет',
      full_text: 'привет',
      sequence: 1,
    })

    expect(stale).toBe(current)
    expect(stale.fullText).toBe('привет мир')
  })

  it('tracks opaque legacy strings separately from numeric sequences', () => {
    const state = reduceMessages([
      { type: 'gesture', text: 'число', sequence: 2 },
      { type: 'gesture', text: 'строка', sequence: '2' },
      { type: 'gesture', text: 'токен', sequence: 'legacy-token' },
      { type: 'gesture', text: 'дубль', sequence: 'legacy-token' },
    ])

    expect(state.sequenceHighWater.numeric).toBe(2)
    expect(state.sequenceHighWater.legacy).toBe('legacy-token')
    expect(state.gestures.map((gesture) => gesture.text)).toEqual(['число', 'строка', 'токен'])
  })

  it('marks formatting without revising text until a transcript arrives', () => {
    const draft = reduceLiveTranscript(createLiveTranscriptState(), {
      type: 'gesture',
      text: 'я школа',
      full_text: 'я школа',
      final_text: '',
      draft_text: 'я школа',
      sequence: 1,
    })
    const formatting = reduceLiveTranscript(draft, {
      type: 'formatting',
      full_text: 'я школа',
      final_text: '',
      draft_text: 'я школа',
      segment_id: 'segment-1',
      status: 'formatting',
    })

    expect(formatting.formatting.active).toBe(true)
    expect(formatting.revision).toBe(0)
    expect(formatting.finalText).toBe('')

    const enhanced = reduceLiveTranscript(formatting, {
      type: 'transcript',
      text: 'Я иду в школу.',
      full_text: 'Я иду в школу.',
      final_text: 'Я иду в школу.',
      draft_text: '',
      segment_id: 'segment-1',
      status: 'enhanced',
      enhanced: true,
    })

    expect(enhanced.formatting.active).toBe(false)
    expect(enhanced.finalKind).toBe('enhanced')
    expect(enhanced.finalText).toBe('Я иду в школу.')
    expect(enhanced.draftText).toBe('')
    expect(enhanced.revision).toBe(1)
  })

  it('keeps a newer raw tail when an earlier segment is enhanced', () => {
    const state = reduceMessages([
      {
        type: 'gesture',
        text: 'привет',
        full_text: 'привет',
        final_text: '',
        draft_text: 'привет',
        sequence: 1,
        segment_id: 1,
      },
      {
        type: 'formatting',
        full_text: 'привет',
        final_text: '',
        draft_text: 'привет',
        segment_id: 1,
        status: 'formatting',
      },
      {
        type: 'gesture',
        text: 'дом',
        full_text: 'привет дом',
        final_text: '',
        draft_text: 'привет дом',
        sequence: 2,
        segment_id: 2,
      },
      {
        type: 'transcript',
        text: 'Привет!',
        full_text: 'Привет! дом',
        final_text: 'Привет!',
        draft_text: 'дом',
        segment_id: 1,
        status: 'enhanced',
        enhanced: true,
      },
    ])

    expect(state.finalText).toBe('Привет!')
    expect(state.draftText).toBe('дом')
    expect(state.fullText).toBe('Привет! дом')
    expect(state.gestures.map((gesture) => gesture.text)).toEqual(['привет', 'дом'])
  })

  it('keeps formatting snapshots authoritative without treating them as a rewrite', () => {
    const state = reduceMessages([
      {
        type: 'gesture',
        text: 'день',
        full_text: 'день',
        final_text: '',
        draft_text: 'день',
        sequence: 8,
      },
      {
        type: 'formatting',
        full_text: 'день добрый',
        final_text: '',
        draft_text: 'день добрый',
        segment_id: 'segment-2',
      },
    ])

    expect(state.fullText).toBe('день добрый')
    expect(state.draftText).toBe('день добрый')
    expect(state.revision).toBe(0)
  })

  it('truncates one coherent transcript snapshot instead of each part independently', () => {
    const finalText = 'ф'.repeat(MAX_LIVE_TRANSCRIPT_LENGTH - 4)
    const draftText = 'черновик'
    const fullText = `${finalText} ${draftText}`
    const state = reduceLiveTranscript(createLiveTranscriptState(), {
      type: 'transcript',
      text: draftText,
      full_text: fullText,
      final_text: finalText,
      draft_text: draftText,
      status: 'literal',
    })

    expect(state.fullText).toBe(fullText.slice(-MAX_LIVE_TRANSCRIPT_LENGTH))
    expect(state.fullText).toBe(`${state.finalText} ${state.draftText}`)
    expect(state.fullText).toHaveLength(MAX_LIVE_TRANSCRIPT_LENGTH)
  })

  it('keeps an inconsistent legacy full snapshot authoritative and coherent', () => {
    const state = reduceLiveTranscript(createLiveTranscriptState(), {
      type: 'transcript',
      text: 'фрагмент',
      full_text: 'авторитетный текст',
      final_text: 'другой',
      draft_text: 'черновик',
    })

    expect(state.fullText).toBe('авторитетный текст')
    expect(state.finalText).toBe('авторитетный текст')
    expect(state.draftText).toBe('')
  })

  it('marks finalized text as mixed after enhanced and literal segments', () => {
    const state = reduceMessages([
      {
        type: 'transcript',
        text: 'Привет.',
        full_text: 'Привет.',
        final_text: 'Привет.',
        draft_text: '',
        status: 'enhanced',
        enhanced: true,
      },
      {
        type: 'transcript',
        text: 'дом',
        full_text: 'Привет. дом',
        final_text: 'Привет. дом',
        draft_text: '',
        status: 'literal',
        enhanced: false,
      },
    ])

    expect(state.finalKind).toBe('mixed')
  })

  it('retains recognizer evidence and a monotonic truncation marker', () => {
    const state = reduceMessages([
      {
        type: 'gesture',
        text: 'я',
        full_text: 'я',
        literal_text: 'я',
        sequence: 1,
        truncated: true,
      },
      {
        type: 'transcript',
        text: 'Я.',
        full_text: 'Я.',
        literal_text: 'я',
        final_text: 'Я.',
        draft_text: '',
        status: 'enhanced',
        enhanced: true,
        truncated: false,
      },
    ])

    expect(state.literalText).toBe('я')
    expect(state.fullText).toBe('Я.')
    expect(state.truncated).toBe(true)
  })

  it('creates concise event announcements and suppresses stale gesture announcements', () => {
    const message = {
      type: 'gesture',
      text: 'дом',
      full_text: 'очень длинный полный текст',
      sequence: 7,
    }
    const initial = createLiveTranscriptState()
    const accepted = reduceLiveTranscript(initial, message)
    const replayed = reduceLiveTranscript(accepted, message)

    expect(getLiveMessageAnnouncement(message)).toBe('Жест 7: дом')
    expect(
      getLiveMessageAnnouncement({
        type: 'formatting',
        last_sequence: 8,
        status: 'formatting',
      }),
    ).toBe('ИИ оформляет фразу до жеста 8.')
    expect(
      getLiveMessageAnnouncement({
        type: 'transcript',
        text: 'Я иду домой.',
        full_text: 'не объявлять этот полный текст',
        sequence: 9,
        status: 'enhanced',
        enhanced: true,
      }),
    ).toBe('Фраза оформлена до жеста 9: Я иду домой.')
    expect(shouldAnnounceLiveMessage(initial, accepted, message)).toBe(true)
    expect(shouldAnnounceLiveMessage(accepted, replayed, message)).toBe(false)
  })

  it('supports legacy transcript deltas and full snapshots without duplication', () => {
    const state = reduceMessages([
      { type: 'transcript', text: 'привет' },
      { type: 'transcript', text: 'мир', full_text: 'привет мир' },
      { type: 'transcript', text: 'мир', full_text: 'привет мир' },
    ])

    expect(state.fullText).toBe('привет мир')
    expect(state.finalText).toBe('привет мир')
    expect(state.draftText).toBe('')
    expect(state.finalKind).toBe('literal')
    expect(state.revision).toBe(2)
  })
})
