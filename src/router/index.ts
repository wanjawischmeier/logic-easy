import { createRouter, createWebHistory } from 'vue-router'
import DockView from '../views/DockView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/logic-easy/',
      name: 'dock',
      component: DockView,
    },
  ],
})

export default router
