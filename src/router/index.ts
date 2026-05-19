import { createRouter, createWebHashHistory } from 'vue-router'
import DockView from '@/views/DockView.vue'

const router = createRouter({
  history: createWebHashHistory('/logic-easy/'),
  routes: [
    {
      path: '/',
      name: 'home',
      component: DockView,
    },
    {
      path: '/about',
      name: 'about',
      component: DockView,
    },
    {
      path: '/project/:projectId',
      name: 'project',
      component: DockView,
    },
  ],
})

export default router
