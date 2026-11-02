// Produces the offline teaching files from the same notes shown in the app.
const fs = require("node:fs");
const path = require("node:path");
const ts = require("../apps/web/node_modules/typescript");
const root = path.resolve(__dirname, "..");
const moduleSource = fs.readFileSync(
  path.join(root, "apps/web/src/lib/workshop.ts"),
  "utf8",
);
const compiled = ts.transpileModule(moduleSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const exported = {};
new Function("exports", compiled)(exported);
const destination = path.join(root, "apps/web/public/downloads");
fs.mkdirSync(destination, { recursive: true });
for (const locale of ["vi", "en"]) {
  const vi = locale === "vi";
  const resources = exported.practiceResources.map((item) => ({
    topic: item.topic,
    title: item.title[locale],
    description: item.description[locale],
    note: item.note[locale],
    exercise: item.exercise[locale],
  }));
  const source = `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${vi ? "Thư viện tài liệu nhỏ" : "The little resource library"} · CodingBuddy</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f5f7fc; color: #18243d; font: 16px/1.8 system-ui, sans-serif; }
    main { max-width: 800px; margin: 35px auto; padding: 25px; }
    header p, small { color: #526078; } h1 { font-size: 32px; line-height: 1.35; }
    input { width: 100%; padding: 13px; font: inherit; border: 1px solid #8996ac; border-radius: 8px; }
    nav { display: flex; gap: 8px; flex-wrap: wrap; margin: 15px 0; }
    button { font: inherit; cursor: pointer; } nav button { padding: 8px 15px; border: 1px solid #cbd5e8; border-radius: 6px; background: #fff; color: #18243d; }
    nav button[aria-pressed="true"] { background: #294bc9; color: #fff; }
    ul { list-style: none; margin: 0; padding: 0; } li { border-bottom: 1px solid #dce3ef; }
    li button { display: block; width: 100%; text-align: left; background: #fff; border: 0; padding: 20px; color: #18243d; }
    li button:hover { background: #edf2ff; } strong, small { display: block; }
    :focus-visible { outline: 3px solid #294bc9; outline-offset: 3px; }
    #note { margin-top: 25px; background: #fff; padding: 23px; border-radius: 9px; } #task { border-left: 3px solid #dcad4e; padding: 12px 18px; background: #fff8e9; }
    footer { margin-top: 28px; color: #526078; font-size: 14px; }
    @media (max-width: 500px) { main { margin: 0; padding: 20px; } h1 { font-size: 27px; } }
  </style>
</head>
<body>
<main>
  <header><p>CodingBuddy / ${vi ? "Bài thực hành mở" : "Open practice project"}</p>
    <h1>${vi ? "Thư viện tài liệu cho lớp mình" : "A resource library for our classroom"}</h1>
    <p>${vi ? "Tìm một ghi chú, đọc và thử làm. Bạn có thể sửa tệp này bằng một trình soạn thảo." : "Find a note, read it, and try an exercise. You can edit this file in a text editor."}</p>
  </header>
  <label for="search">${vi ? "Tìm tài liệu" : "Search resources"}</label>
  <input id="search" type="search" placeholder="${vi ? "Ví dụ: biến, HTML…" : "Try variables, HTML…"}">
  <nav aria-label="${vi ? "Chủ đề" : "Topics"}">
    <button type="button" data-topic="all" aria-pressed="true">${vi ? "Tất cả" : "All topics"}</button>
    <button type="button" data-topic="python" aria-pressed="false">Python</button>
    <button type="button" data-topic="web" aria-pressed="false">Web</button>
    <button type="button" data-topic="thinking" aria-pressed="false">${vi ? "Tư duy" : "Thinking"}</button>
  </nav>
  <p id="count" aria-live="polite"></p><ul id="results"></ul>
  <section id="note" hidden><h2 id="title"></h2><p id="content"></p><p id="task"></p></section>
  <footer>${vi ? "Đến lượt bạn: tìm mảng resources trong mã nguồn và thêm một ghi chú hữu ích. Lưu tệp, rồi tải lại trang." : "Your turn: find the resources array in this source and add a useful note. Save the file, then reload the page."}</footer>
</main>
<script>
// Your library data. Add another object here to add a note.
const resources = ${JSON.stringify(resources, null, 2).replace(/</g, "\\u003c")};

const search = document.getElementById("search");
const results = document.getElementById("results");
let topic = "all";
function normalize(value) {
  return value.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/đ/g, "d").toLowerCase().trim();
}
function render() {
  const term = normalize(search.value);
  const matches = resources.filter((resource) =>
    (topic === "all" || resource.topic === topic) &&
    normalize(resource.title + " " + resource.description + " " + resource.topic).includes(term)
  );
  results.replaceChildren();
  document.getElementById("count").textContent = matches.length + " ${vi ? "ghi chú" : "notes"}";
  if (!matches.length) {
    const empty = document.createElement("p");
    empty.textContent = ${JSON.stringify(vi ? "Chưa có ghi chú phù hợp. Thử một từ ngắn hơn hoặc chọn tất cả chủ đề." : "No matching notes. Try a shorter word, or choose all topics.")};
    results.append(empty);
  }
  matches.forEach((resource) => {
    const row = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    const title = document.createElement("strong");
    title.textContent = resource.title;
    const description = document.createElement("small");
    description.textContent = resource.description;
    button.append(title, description);
    button.addEventListener("click", () => {
      document.getElementById("note").hidden = false;
      document.getElementById("title").textContent = resource.title;
      document.getElementById("content").textContent = resource.note;
      document.getElementById("task").textContent = resource.exercise;
    });
    row.append(button);
    results.append(row);
  });
}
search.addEventListener("input", render);
document.querySelectorAll("[data-topic]").forEach((button) => {
  button.addEventListener("click", () => {
    topic = button.dataset.topic;
    document.querySelectorAll("[data-topic]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    render();
  });
});
render();
</script>
</body>
</html>
`;
  fs.writeFileSync(
    path.join(destination, "resource-library-" + locale + ".html"),
    source,
  );
  const inline = source.match(/<script>([\s\S]*?)<\/script>/)[1];
  new Function(inline);
}
console.log(
  "Built and syntax-checked the Vietnamese and English offline practice files.",
);
