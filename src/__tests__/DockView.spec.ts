import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import DockView from '../views/DockView.vue'

describe('DockView', () => {
  it('mounts renders properly', () => {
    const wrapper = mount(DockView)
    expect(wrapper.text()).toContain('LogicEasy')
  })
})
