import { createRouter, createWebHistory } from 'vue-router'
import HomeScreen from '../views/HomeScreen.vue'
import DockView from '../views/DockView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/logic-easy/',
      name: 'home',
      component: HomeScreen,
    },
    {
      path: '/logic-easy/view',
      name: 'view',
      component: DockView,
    },
  ],
})

export default router
