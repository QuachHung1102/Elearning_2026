import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  enrollmentMessage,
  resolveEnrollmentContact,
} from "./direct-enrollment";
import { EnrollmentContactCard } from "@/components/enrollment/contact-card";
import { EnrollCta } from "@/components/catalog/enroll-cta";

describe("direct enrollment", () => {
  it("shows a truthful pending state without a fake QR or contact link", () => {
    const contact = resolveEnrollmentContact({});
    const html = renderToStaticMarkup(
      createElement(EnrollmentContactCard, { contact, locale: "en" }),
    );
    expect(html).toContain("Zalo QR coming soon");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("href=");
  });

  it("uses supplied public contacts and a local owner-provided QR", () => {
    const contact = resolveEnrollmentContact({
      zaloQrImage: "/images/zalo-contact.png",
      zaloUrl: "https://zalo.me/0123456789",
      phone: "+84 123 456 789",
      email: "nam+courses@example.com",
    });
    const html = renderToStaticMarkup(
      createElement(EnrollmentContactCard, { contact, locale: "en" }),
    );
    expect(html).toContain('src="/images/zalo-contact.png"');
    expect(html).toContain('href="https://zalo.me/0123456789"');
    expect(html).toContain('href="tel:+84123456789"');
    expect(html).toContain('href="mailto:nam+courses@example.com"');
    expect(html).not.toContain("coming soon");
  });

  it("does not turn malformed contact data into clickable destinations", () => {
    expect(
      resolveEnrollmentContact({
        zaloQrImage: "//other.example/qr.png",
        zaloUrl: "https://zalo.me.other.example/profile",
        phone: "javascript:alert(1)",
        email: "nam@example.com%0aBCC:other.test",
      }),
    ).toEqual({ zaloQrImage: null, zaloUrl: null, phone: null, email: null });
    expect(
      resolveEnrollmentContact({
        zaloQrImage: "/images/../qr.png",
        zaloUrl: "javascript:alert(1)",
      }).zaloQrImage,
    ).toBeNull();
  });

  it("preserves the chosen course in either message without inventing a buyer email", () => {
    const course = { title: "Python: tủ sách của lớp", slug: "python-books" };
    for (const locale of ["vi", "en"] as const) {
      const message = enrollmentMessage(course, locale);
      expect(message).toContain(course.title);
      expect(message).toContain(course.slug);
      expect(message).not.toContain("@example.com");
    }
    expect(enrollmentMessage(course, "en")).toContain("[fill in your email]");
    expect(enrollmentMessage(course, "vi")).toContain("[điền email của bạn]");
  });

  it("lets guests reach paid-course contact details directly and preserves the free login flow", () => {
    const paid = renderToStaticMarkup(
      createElement(EnrollCta, {
        courseId: "paid",
        slug: "paid-course",
        priceVnd: 500000,
        archived: false,
      }),
    );
    expect(paid).toContain('href="/checkout/paid-course"');
    expect(paid).toContain("Liên hệ đăng ký học");
    expect(paid).not.toContain("/login");
    const free = renderToStaticMarkup(
      createElement(EnrollCta, {
        courseId: "free",
        slug: "free-course",
        priceVnd: 0,
        archived: false,
      }),
    );
    expect(free).toContain("/login?next=");
    expect(free).not.toContain("/checkout/");
  });
});
