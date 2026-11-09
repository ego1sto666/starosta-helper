/* Карта основных разделов и вкладок. Навигация и адреса используют один источник. */
(() => {
  "use strict";
  window.StarostaRoutes = Object.freeze({
    sections: [
      ["home", "Сегодня", "home"],
      ["journal", "Журнал", "journal"],
      ["group", "Группа", "group"],
      ["study", "Учёба", "exam"],
      ["tasks", "Внеучебка", "party"],
    ],
    tabs: {
      study: [["works", "Сдачи", "#study/works"], ["exams", "Сессия", "#study/exams"], ["grades", "Оценки", "#study/grades"]],
      tasks: [["tasks", "Дела", "#tasks"], ["funds", "Сборы", "#tasks/funds"], ["events", "События", "#events"], ["polls", "Опросы", "#tasks/polls"]],
    },
  });
})();
