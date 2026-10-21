// Настройки интерфейса. Файл подключается до app.js.
window.FARCIPAL = {
  // demo-режим: интерфейс работает без бэкенда, данные вымышленные.
  // Включается сам: на GitHub Pages, при открытии файла с диска (file://)
  // и по адресу вида index.html?demo. Чтобы форсировать, поставьте true.
  demo:
    location.hostname.endsWith("github.io") ||
    location.protocol === "file:" ||
    new URLSearchParams(location.search).has("demo"),
};
