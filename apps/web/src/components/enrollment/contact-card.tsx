import { Mail, MessageCircle, Phone, ArrowUpRight } from "lucide-react";
import type { EnrollmentContact } from "@/lib/direct-enrollment";
import { translate, type Locale } from "@/lib/translations";

export function EnrollmentContactCard({
  contact,
  locale,
}: {
  contact: EnrollmentContact;
  locale: Locale;
}) {
  const t = (vi: string, en: string) => translate(locale, vi, en);
  const vnPhone = contact.phone?.match(/^\+84(\d{3})(\d{3})(\d{3})$/);
  const phoneLabel = vnPhone
    ? `${locale === "vi" ? "0" : "+84 "}${vnPhone[1]} ${vnPhone[2]} ${vnPhone[3]}`
    : contact.phone;
  const hasContact = Boolean(
    contact.zaloQrImage || contact.zaloUrl || contact.phone || contact.email,
  );
  return (
    <section
      className="direct-contact-card"
      aria-labelledby="direct-contact-title"
    >
      <p className="section-label">
        {t("CÙNG TRAO ĐỔI TRƯỚC KHI HỌC", "LET’S TALK BEFORE YOU JOIN")}
      </p>
      <h2 id="direct-contact-title">
        {t("Liên hệ Hải Nam", "Contact Hải Nam")}
      </h2>
      {contact.zaloQrImage ? (
        <div className="contact-qr-ready">
          {/* Owner-supplied public contact QR; no generated payment code. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={contact.zaloQrImage}
            alt={t(
              "Mã QR liên hệ Zalo của Hải Nam",
              "Hải Nam’s Zalo contact QR",
            )}
            width={240}
            height={240}
          />
          <p>
            {t(
              "Quét mã bằng Zalo để mở cuộc trò chuyện với Nam.",
              "Scan with Zalo to start a conversation with Nam.",
            )}
          </p>
        </div>
      ) : (
        <div className="contact-qr-placeholder" role="status">
          <MessageCircle size={42} strokeWidth={1.5} aria-hidden="true" />
          <strong>
            {t("QR Zalo đang được cập nhật", "Zalo QR coming soon")}
          </strong>
          <p>
            {hasContact
              ? t(
                  "Bạn có thể dùng thông tin liên hệ bên dưới.",
                  "You can use the contact details below.",
                )
              : t(
                  "Mã QR và thông tin liên hệ của Nam sẽ xuất hiện ở đây.",
                  "Nam’s QR and contact details will appear here.",
                )}
          </p>
        </div>
      )}
      <div className="direct-contact-links">
        {contact.zaloUrl && (
          <a
            className="studio-button"
            href={contact.zaloUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle size={18} aria-hidden="true" />
            {t("Nhắn Nam trên Zalo", "Message Nam on Zalo")}
            <ArrowUpRight size={17} aria-hidden="true" />
          </a>
        )}
        {contact.phone && (
          <a href={`tel:${contact.phone}`}>
            <Phone size={18} aria-hidden="true" />
            <span>{phoneLabel}</span>
          </a>
        )}
        {contact.email && (
          <a href={`mailto:${contact.email}`}>
            <Mail size={18} aria-hidden="true" />
            <span>{contact.email}</span>
          </a>
        )}
        {contact.zaloQrImage && (
          <a href={contact.zaloQrImage} download>
            {t("Lưu mã QR Zalo", "Save the Zalo QR")}
          </a>
        )}
      </div>
      <p className="direct-contact-caption">
        {hasContact
          ? t(
              "Trao đổi học phí, cách tham gia và thời gian học trực tiếp với Nam.",
              "Discuss the fee, how to join, and the learning schedule directly with Nam.",
            )
          : t(
              "Thông tin liên hệ chưa được thêm. Bạn có thể xem khóa học và chuẩn bị nội dung tin nhắn bên cạnh.",
              "Contact details haven’t been added yet. You can review the course and prepare your message alongside.",
            )}
      </p>
    </section>
  );
}
