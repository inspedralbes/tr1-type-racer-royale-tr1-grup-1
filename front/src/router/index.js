import { createRouter, createWebHistory } from "vue-router";
import HomeView from "@/pages/HomeView.vue";
import LobbyView from "@/pages/LobbyView.vue";
import PlayView from "@/pages/PlayView.vue";
import EndView from "@/pages/EndView.vue";
import { useUserStore } from "@/stores/user";
import CreateRoomView from "@/pages/CreateRoomView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: HomeView },
    {
      path: "/createRoom",
      name: "createRoom",
      component: CreateRoomView,
    },
    {
      path: "/play",
      name: "play",
      component: PlayView,
      meta: { requiresRoom: true },
    },
    {
      path: "/lobby",
      name: "lobby",
      component: LobbyView,
      meta: { requiresRoom: true },
    },
    {
      path: "/fin",
      name: "fin",
      component: EndView,
      meta: { requiresRoom: true },
    },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});

router.beforeEach((to) => {
  const user = useUserStore();
  if (to.meta.requiresNick && !user.hasNick) {
    return {
      name: "home",
      query: { needNick: "1", redirectTo: to.fullPath },
    };
  }
});

export default router;
