import type { Locale } from "./translations";

export type ResourceTopic = "python" | "web" | "thinking";
export type PracticeResource = {
  id: string;
  topic: ResourceTopic;
  title: Record<Locale, string>;
  description: Record<Locale, string>;
  note: Record<Locale, string>;
  exercise: Record<Locale, string>;
};
export const practiceResources: PracticeResource[] = [
  {
    id: "variables",
    topic: "python",
    title: {
      vi: "Biến: đặt tên cho một thông tin",
      en: "Variables: give information a name",
    },
    description: {
      vi: "Bắt đầu với tên, giá trị và một phép tính nhỏ.",
      en: "Start with names, values, and a small calculation.",
    },
    note: {
      vi: "Một biến giúp chương trình ghi nhớ một giá trị. Với books = 3, tên books giữ giá trị 3. Khi thêm một cuốn sách, bạn có thể viết books = books + 1. Chọn tên dễ hiểu để người khác cũng đọc được chương trình.",
      en: "A variable helps a program remember a value. With books = 3, the name books holds the value 3. Add a book with books = books + 1. Choose a name that makes your program understandable to someone else.",
    },
    exercise: {
      vi: "Tạo biến books với giá trị 3. Thêm 2 cuốn và in số sách mới bằng print(books).",
      en: "Create a books variable with a value of 3. Add 2 books, then print the new count with print(books).",
    },
  },
  {
    id: "lists",
    topic: "python",
    title: {
      vi: "Danh sách: gom những điều liên quan",
      en: "Lists: keep related things together",
    },
    description: {
      vi: "Lưu các tài liệu cùng nhau, thay vì ghi nhớ từng cái.",
      en: "Keep resources together instead of remembering each one.",
    },
    note: {
      vi: 'Một danh sách có thể chứa nhiều mục: titles = ["Biến", "Danh sách"]. Dùng vòng lặp for title in titles: để xem từng mục. Đây là cách một thư viện nhỏ có thể bắt đầu từ vài dòng code.',
      en: 'A list can hold several items: titles = ["Variables", "Lists"]. Use for title in titles: to go through the items. A small library can start with just a few lines of code.',
    },
    exercise: {
      vi: "Thêm tên một bài học vào danh sách. Dùng vòng lặp để in từng tên trên một dòng riêng.",
      en: "Add a lesson title to the list. Use a loop to print each title on its own line.",
    },
  },
  {
    id: "html",
    topic: "web",
    title: {
      vi: "HTML: sắp xếp một trang dễ đọc",
      en: "HTML: give a page a readable structure",
    },
    description: {
      vi: "Dùng tiêu đề, đoạn văn và liên kết đúng chỗ.",
      en: "Put headings, paragraphs, and links in the right places.",
    },
    note: {
      vi: "HTML mô tả cấu trúc của trang. Dùng h1 cho tiêu đề chính, p cho một đoạn văn và a cho liên kết. Nhãn rõ ràng và thứ tự đọc hợp lý giúp người mới tìm thấy điều họ cần.",
      en: "HTML describes a page’s structure. Use h1 for its main heading, p for a paragraph, and a for a link. Clear labels and a sensible reading order help a new visitor find what they need.",
    },
    exercise: {
      vi: "Tạo một trang giới thiệu tài liệu yêu thích. Viết tiêu đề rõ ràng và một câu giải thích tài liệu giúp người đọc làm được gì.",
      en: "Make a page about a resource you like. Give it a clear title and explain what it helps the reader do.",
    },
  },
  {
    id: "debug",
    topic: "thinking",
    title: {
      vi: "Sửa lỗi: thay từng điều một",
      en: "Debugging: change one thing at a time",
    },
    description: {
      vi: "Quan sát kết quả, thử một giả thuyết rồi kiểm tra lại.",
      en: "Observe the result, try a hypothesis, and check again.",
    },
    note: {
      vi: "Khi kết quả không như mong muốn, hãy ghi lại điều bạn nghĩ sẽ xảy ra và điều thực sự xảy ra. Kiểm tra một phần nhỏ của chương trình. Thay một điều mỗi lần để biết thay đổi nào đã giúp.",
      en: "When a result surprises you, write down what you expected and what actually happened. Test one small part of the program. Change one thing at a time so you can tell what helped.",
    },
    exercise: {
      vi: "Thử tìm một từ chưa có trong thư viện. Giao diện nên giải thích điều gì? Viết một thông báo giúp người dùng biết cách thử lại.",
      en: "Search for a word that is not in the library. What should the interface explain? Write a message that helps someone try again.",
    },
  },
];

export function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLocaleLowerCase()
    .trim();
}
export function filterResources(
  resources: PracticeResource[],
  query: string,
  topic: string,
  locale: Locale,
) {
  const term = normalizeSearch(query);
  return resources.filter(
    (resource) =>
      (topic === "all" || resource.topic === topic) &&
      normalizeSearch(
        `${resource.title[locale]} ${resource.description[locale]} ${resource.topic}`,
      ).includes(term),
  );
}
