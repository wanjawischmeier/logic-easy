import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      // simple empty component - the app root contains the dockview
      component: {
        template: '<div></div>'
      }
    },
  ],
})

export default router
