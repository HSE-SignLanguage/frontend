// @vitest-environment happy-dom

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ModernView from './ModernView.vue'
import SimpleView from './SimpleView.vue'

function createCameraStream() {
  const track = { readyState: 'live', stop: vi.fn() }
  return {
    stream: {
      getTracks: () => [track],
      getVideoTracks: () => [track],
    },
    track,
  }
}

class FakeWebSocket {
  constructor(url) {
    this.url = url
    this.readyState = 0
    this.bufferedAmount = 0
  }

  close() {
    this.readyState = 3
  }
}

function mountView(component) {
  return mount(component, {
    attachTo: document.body,
    global: {
      stubs: {
        RouterLink: {
          template: '<a href="#"><slot /></a>',
        },
      },
    },
  })
}

let wrappers = []
let getUserMedia

beforeEach(() => {
  getUserMedia = vi.fn()
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  })
  vi.stubGlobal('WebSocket', FakeWebSocket)
})

afterEach(() => {
  wrappers.forEach((wrapper) => wrapper.unmount())
  wrappers = []
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('camera permission lifecycle', () => {
  it.each([
    ['обычном', ModernView, '.stream-btn'],
    ['упрощённом', SimpleView, '.btn-start'],
  ])('запрашивает камеру только после явного запуска в %s режиме', async (_, component, button) => {
    const { stream } = createCameraStream()
    getUserMedia.mockResolvedValue(stream)

    const wrapper = mountView(component)
    wrappers.push(wrapper)

    await flushPromises()
    expect(getUserMedia).not.toHaveBeenCalled()

    await wrapper.get(button).trigger('click')
    await flushPromises()
    expect(getUserMedia).toHaveBeenCalledOnce()
  })
})

describe('mobile navigation drawer', () => {
  it('isolates focus, closes on Escape and returns focus to the menu button', async () => {
    const wrapper = mountView(ModernView)
    wrappers.push(wrapper)
    const menuButton = wrapper.get('.menu-toggle')

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(menuButton.attributes('aria-controls')).toBe('mobile-navigation-dialog')
    expect(menuButton.attributes('aria-expanded')).toBe('false')

    await menuButton.trigger('click')
    await flushPromises()

    const drawer = wrapper.get('#mobile-navigation-dialog')
    const dialog = wrapper.get('[role="dialog"]')
    const closeButton = wrapper.get('.sidebar-close')
    const lastLink = wrapper.get('.sidebar-nav .nav-link')

    expect(menuButton.attributes('aria-expanded')).toBe('true')
    expect(dialog.attributes('aria-modal')).toBe('true')
    expect(document.activeElement).toBe(closeButton.element)
    expect(wrapper.get('main').attributes()).toHaveProperty('inert')

    lastLink.element.focus()
    await drawer.trigger('keydown', { key: 'Tab' })
    expect(document.activeElement).toBe(closeButton.element)

    closeButton.element.focus()
    await drawer.trigger('keydown', { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(lastLink.element)

    await drawer.trigger('keydown', { key: 'Escape' })
    await flushPromises()

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(menuButton.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(menuButton.element)
  })

  it('closes when the layout switches from mobile to desktop', async () => {
    let viewportListener
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      addEventListener: (_, listener) => {
        viewportListener = listener
      },
      removeEventListener: vi.fn(),
    })

    const wrapper = mountView(ModernView)
    wrappers.push(wrapper)
    await wrapper.get('.menu-toggle').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)

    viewportListener({ matches: false })
    await flushPromises()

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.get('main').attributes()).not.toHaveProperty('inert')
  })

  it('supports legacy MediaQueryList listeners used by older Safari', async () => {
    let viewportListener
    const removeListener = vi.fn()
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      addListener: (listener) => {
        viewportListener = listener
      },
      removeListener,
    })

    const wrapper = mountView(ModernView)
    wrappers.push(wrapper)
    await wrapper.get('.menu-toggle').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)

    viewportListener({ matches: false })
    await flushPromises()

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.get('main').attributes()).not.toHaveProperty('inert')

    wrapper.unmount()
    wrappers = wrappers.filter((candidate) => candidate !== wrapper)
    expect(removeListener).toHaveBeenCalledWith(viewportListener)
  })
})
