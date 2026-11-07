// Локальная разработка: сервер API запускается отдельно на 8000.
// Для публикации задайте адрес API и политику обработки данных в конфигурации развёртывания.
if (location.hostname === "127.0.0.1" && location.port === "8765") {
  window.STAROSTA_API = "http://127.0.0.1:8000";
  window.STAROSTA_PRIVACY_URL = "/privacy.html";
}
