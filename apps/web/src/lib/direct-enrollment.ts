import settings from "@/content/enrollment-contact.json";
import type { Locale } from "./translations";

export type EnrollmentContact = {
  zaloQrImage: string | null;
  zaloUrl: string | null;
  phone: string | null;
  email: string | null;
};

/** Only intentional public contact details belong in this config. */
export function resolveEnrollmentContact(
  input: Partial<Record<keyof EnrollmentContact, string>>,
): EnrollmentContact {
  const image = input.zaloQrImage?.trim() ?? "";
  const zalo = input.zaloUrl?.trim() ?? "";
  const phone = input.phone?.replace(/[\s()-]/g, "") ?? "";
  const email = input.email?.trim() ?? "";
  let zaloUrl: string | null = null;
  try {
    const url = new URL(zalo);
    if (
      url.protocol === "https:" &&
      url.hostname === "zalo.me" &&
      !url.username &&
      !url.password &&
      !url.port
    )
      zaloUrl = url.href;
  } catch {
    /* No contact link until a real profile URL is supplied. */
  }
  return {
    zaloQrImage:
      /^\/(?!\/)[a-zA-Z0-9_/-]+\.(png|jpg|jpeg|webp)$/i.test(image) &&
      !image.includes("..")
        ? image
        : null,
    zaloUrl,
    phone: /^\+?\d{7,15}$/.test(phone) ? phone : null,
    email: /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)
      ? email
      : null,
  };
}

export const enrollmentContact = resolveEnrollmentContact(settings);

export function enrollmentMessage(
  course: { title: string; slug: string },
  locale: Locale,
): string {
  return locale === "en"
    ? `Hi Nam, I’d like to enroll in this course:\n${course.title}\nCourse: ${course.slug}\nMy learning account email: [fill in your email]\nPlease let me know the fee and how to join. Thank you!`
    : `Chào Nam, mình muốn đăng ký khóa học:\n${course.title}\nMã khóa học: ${course.slug}\nEmail tài khoản học của mình: [điền email của bạn]\nNhờ bạn hướng dẫn học phí và cách tham gia. Cảm ơn Nam!`;
}
