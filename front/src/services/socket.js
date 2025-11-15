import { io } from "socket.io-client";

const BACKEND = import.meta.env.VITE_URL_BACK;
export const socket = io(BACKEND);
