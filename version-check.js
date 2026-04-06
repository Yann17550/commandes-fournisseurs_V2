function() {
  const current = window.__FILE_VERSIONS__ || {};
  const previous = JSON.parse(localStorage.getItem("file_versions") || "{}");

  const changed = [];

  for (const file in current) {
    if (previous[file] && previous[file] !== current[file]) {
      changed.push({
        file,
        old: previous[file],
        new: current[file]
      });
    }
  }

  if (changed.length > 0) {
    console.warn("⚠️ Certains fichiers ne sont pas encore déployés !");
    changed.forEach(c => {
      console.warn(`- ${c.file} : ${c.old} → ${c.new}`);
    });
    alert("⚠️ Déploiement incomplet : certains fichiers ne sont pas encore mis à jour.");
  }

  localStorage.setItem("file_versions", JSON.stringify(current));
})();
