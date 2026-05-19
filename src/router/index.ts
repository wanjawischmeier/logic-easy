import { createRouter, createWebHistory } from 'vue-router'
import DockView from '@/views/DockView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/logic-easy/',
      name: 'home',
      component: DockView,
    },
    {
      path: '/logic-easy/about',
      name: 'about',
      component: DockView,
    },
    {
      path: '/logic-easy/project/:projectId',
      name: 'project',
      component: DockView,
    },
  ],
})

export default router
