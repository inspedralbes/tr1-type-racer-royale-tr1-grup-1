const BACK_URL = import.meta.env.VITE_URL_BACK;

export const getText = async (id) => {
  const response = await fetch(`${BACK_URL}/texts/${id}`);
  const data = await response.json();

  // Normalizar diferentes nombres de columna/propiedades que pueda devolver
  // el backend (ej. TEXT_CONTENT en la base de datos) a la propiedad `text`
  if (data) {
    const normalized = {
      ...data,
      text:
        data.text || data.TEXT || data.text_content || data.TEXT_CONTENT || "",
    };
    return normalized;
  }

  return { text: "" };
};
