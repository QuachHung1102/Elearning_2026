"use client";

export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="vi">
      <body
        style={{
          margin: 0,
          background: "#ffffff",
          color: "#000000",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <main style={{ maxWidth: 640, margin: "0 auto", padding: 32 }}>
          <h1 tabIndex={-1}>Đã xảy ra lỗi</h1>
          <p>Tải lại trang giúp bạn trong hầu hết trường hợp.</p>
          <button
            type="button"
            onClick={retry}
            style={{
              minHeight: 44,
              padding: "8px 16px",
              border: "2px solid #000000",
              background: "#ffffff",
              color: "#000000",
              fontWeight: 700,
            }}
          >
            Tải lại trang
          </button>
        </main>
      </body>
    </html>
  );
}
