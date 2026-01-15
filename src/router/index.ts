import { createRouter, createWebHistory } from 'vue-router'
import { isAuthenticated } from '../features/auth/session'

const LoginPage = () => import('../screens/LoginPage.vue')
const CatalogPage = () => import('../screens/CatalogPage.vue')
const ProductPage = () => import('../screens/ProductPage.vue')
const CartPage = () => import('../screens/CartPage.vue')
const CheckoutPage = () => import('../screens/CheckoutPage.vue')

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: () => (isAuthenticated() ? '/catalog' : '/login'),
    },
    {
      path: '/login',
      name: 'login',
      component: LoginPage,
    },
    {
      path: '/catalog',
      name: 'catalog',
      component: CatalogPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/product/:id',
      name: 'product',
      component: ProductPage,
      meta: { requiresAuth: true },
      props: true,
    },
    {
      path: '/cart',
      name: 'cart',
      component: CartPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/checkout',
      name: 'checkout',
      component: CheckoutPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: () => (isAuthenticated() ? '/catalog' : '/login'),
    },
  ],
})

router.beforeEach((to) => {
  const requiresAuth = Boolean(to.meta.requiresAuth)
  const authed = isAuthenticated()

  if (requiresAuth && !authed) {
    return { name: 'login', query: { next: to.fullPath } }
  }

  if (to.name === 'login' && authed) {
    return { name: 'catalog' }
  }

  return true
})
