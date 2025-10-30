const BACK_URL = import.meta.env.VITE_URL_BACK;

export const getText = async (id) => {
  const response = await fetch(`${BACK_URL}/texts/${id}`);
  const data = await response.json();
  return data;
};
