import { defineStore } from "pinia";

export const useUserStore = defineStore("user", {
  state: () => ({
    id: localStorage.getItem("id") || "",
    nickname: localStorage.getItem("nickname") || "",
    roomName: localStorage.getItem("roomName") || "",
  }),
  getters: {
    hasId: (state) => state.id.trim().length > 0,
    hasNick: (state) => state.nickname.trim().length > 0,
    hasRoom: (state) => state.roomName.trim().length > 0,
  },
  actions: {
    setId(id) {
      this.id = id;
      localStorage.setItem("id", this.id);
    },
    clearId() {
      this.id = "";
      localStorage.removeItem("id");
    },
    setNickname(name) {
      this.nickname = name.trim();
      localStorage.setItem("nickname", this.nickname);
    },
    clearNickname() {
      this.nickname = "";
      localStorage.removeItem("nickname");
    },
    setRoomName(name) {
      this.roomName = name;
      localStorage.setItem("roomName", this.roomName);
    },
    clearRoomName() {
      this.roomName = "";
      localStorage.removeItem("roomName");
    },
  },
});
