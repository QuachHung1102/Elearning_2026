# Contacts and project purposes — 2 November 2026

Added the owner's explicitly supplied public contacts to the shared contact/enrollment card:

- Vietnamese display: `0836 110 909`.
- International display: `+84 836 110 909`; clickable destination `tel:+84836110909`.
- Email: `hainam.nguyen.1109@gmail.com`, with a matching `mailto:` link.

The supplied Zalo QR remains available. No direct Zalo profile URL was inferred from a phone number. This update configures public links; it does not configure SMTP or send any message.

Every project now has a dedicated bilingual “Vì sao có dự án này? / Why this project?” section, also shown on the free book workshop. The copy explains a practical purpose and learning rationale rather than inventing personal experiences, users, measured outcomes or partnerships.

| Project | Reason for including it |
| --- | --- |
| Book sharing | Make shared resources discoverable and teach a complete, manageable first tool |
| Lost and found | Organize fragmented information and practice a careful human-verified handover |
| Revision planner | Make capacity and unfinished work visible, with explainable scheduling choices |
| Folder organizer | Reduce repetitive file work while teaching preview, inspection and recovery |
| Club ledger | Make totals traceable and introduce databases through accountable recordkeeping |
| Volunteer shifts | Represent real availability and inspect the choices behind an allocation rule |
| Food waste | Connect environmental questions to consistent measurements and denominators |
| Equipment inventory | Distinguish ownership from availability and model physical-item states |
| Survey report | Represent responses faithfully and explain the scope of a percentage |
| Air-quality diary | Pair environmental curiosity with units, timing, observation counts and uncertainty |

Copy lives in `apps/web/src/content/course-guides.json` under each language's `whyThisProject` field. Contact details live in `apps/web/src/content/enrollment-contact.json`. The public course pages and workshop read the same reason copy, so later edits remain consistent.

No price, availability, paid lesson access, or deployment state was changed.

Verification: all 237 frontend tests, type checks, lint and the optimized production build passed. Forty-two HTTP checks verified all course/workshop reasons and the contact links on every paid enrollment page in both languages. Twelve browser checks covered phone and desktop layouts in VI/EN without horizontal overflow. No email, phone call or Zalo message was sent.

[Project-purpose preview](screenshots/project-reasons-2026-11-02.png)
