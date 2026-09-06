(function (root) {
  const CAT_KEY = "myspace-learning-games-category";

  const CATEGORIES = [
    {
      id: "countries",
      icon: "🌍",
      nameKey: "cat.countries",
      blurbKey: "cat.countries.blurb",
    },
    {
      id: "elements",
      icon: "⚛️",
      nameKey: "cat.elements",
      blurbKey: "cat.elements.blurb",
    },
    {
      id: "models",
      icon: "💳",
      nameKey: "cat.models",
      blurbKey: "cat.models.blurb",
    },
  ];

  function getCategory(id) {
    return CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];
  }

  function loadCategory() {
    try {
      const id = localStorage.getItem(CAT_KEY) || "countries";
      return getCategory(id).id;
    } catch {
      return "countries";
    }
  }

  function saveCategory(id) {
    const next = getCategory(id).id;
    try {
      localStorage.setItem(CAT_KEY, next);
    } catch {
      /* ignore */
    }
    return next;
  }

  function nextCategoryId(currentId) {
    const i = Math.max(0, CATEGORIES.findIndex((c) => c.id === currentId));
    return CATEGORIES[(i + 1) % CATEGORIES.length].id;
  }

  root.LearningGamesCategories = {
    CATEGORIES,
    getCategory,
    loadCategory,
    saveCategory,
    nextCategoryId,
  };
})(window);