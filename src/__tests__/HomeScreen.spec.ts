import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import HomeScreen from '../views/HomeScreen.vue'

describe('HomeScreen', () => {
  it('mounts renders properly', () => {
    const wrapper = mount(HomeScreen)
    expect(wrapper.text()).toContain('Home')
  })
})
