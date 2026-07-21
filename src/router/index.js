import { createRouter, createWebHistory } from 'vue-router'
import ModernView from '../views/ModernView.vue'
import SimpleView from '../views/SimpleView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: ModernView,
    },
    {
      path: '/simple/',
      name: 'simple',
      component: SimpleView,
    },
  ],
})

export default router
