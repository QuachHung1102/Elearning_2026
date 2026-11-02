"use client";

import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { projectCourse } from "@/lib/project-courses";
import { enrollmentMessage } from "@/lib/direct-enrollment";

export function EnrollmentMessageCopy({
  title,
  slug,
}: {
  title: string;
  slug: string;
}) {
  const { locale, text } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [selectManually, setSelectManually] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const planned = projectCourse(slug)?.availability === "planned";
  const message = planned
    ? text(
        `Chào Nam, mình muốn tìm hiểu dự án ${title} (${slug}). Dự án dự kiến có bài học khi nào, và mình cần chuẩn bị gì?`,
        `Hi Nam, I’m interested in ${title} (${slug}). When do you expect the lessons to be available, and what should I prepare?`,
      )
    : enrollmentMessage({ title, slug }, locale);
  async function copy() {
    setCopied(false);
    setSelectManually(false);
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      area.current?.focus();
      area.current?.select();
      setSelectManually(true);
    }
  }
  return (
    <section
      className="enrollment-message"
      aria-labelledby="enrollment-message-title"
    >
      <div className="enrollment-message-heading">
        <h2 id="enrollment-message-title">
          {text("Bạn có thể nhắn như thế này", "Here’s a message you can send")}
        </h2>
        <span>
          {text(
            "Tên khóa học đã được điền sẵn",
            "Your course is already included",
          )}
        </span>
      </div>
      <label className="sr-only" htmlFor="enrollment-message">
        {text("Nội dung đăng ký khóa học", "Course enrollment message")}
      </label>
      <textarea
        id="enrollment-message"
        ref={area}
        value={message}
        readOnly
        rows={7}
        spellCheck={false}
      />
      <div className="enrollment-copy-row">
        <button
          className="studio-button secondary"
          type="button"
          onClick={copy}
        >
          {copied ? (
            <Check size={17} aria-hidden="true" />
          ) : (
            <Copy size={17} aria-hidden="true" />
          )}
          {text("Sao chép tin nhắn", "Copy message")}
        </button>
        <p role="status" aria-live="polite">
          {copied
            ? text(
                planned
                  ? "Đã sao chép tin nhắn tìm hiểu dự án."
                  : "Đã sao chép. Điền email của bạn trước khi gửi cho Nam.",
                planned
                  ? "Project inquiry copied."
                  : "Copied. Fill in your email before sending it to Nam.",
              )
            : selectManually
              ? text(
                  "Đã chọn nội dung. Dùng lệnh sao chép trên thiết bị của bạn.",
                  "Message selected. Use your device’s copy command.",
                )
              : text(
                  planned
                    ? "Bạn có thể sửa câu hỏi trước khi gửi cho Nam."
                    : "Điền email tài khoản học khi gửi tin nhắn.",
                  planned
                    ? "You can edit the question before sending it to Nam."
                    : "Add your learning account email when you send the message.",
                )}
        </p>
      </div>
    </section>
  );
}
