# Direct-contact enrollment

Confirmed user request, 26 October 2026. Local implementation only; nothing uploaded or deployed.

## Student journey

1. Choose a paid course and select “Liên hệ đăng ký học” / “Contact Nam to enroll”.
2. The public /checkout/[courseSlug] page shows the course, listed fee, Zalo/contact card and a message containing the course title and slug.
3. Scan the owner-provided Zalo QR or use the supplied contact link, phone or email. Copy the message if useful, add the learning account email, then arrange enrollment directly with Nam.
4. Nam confirms the arrangement and grants course access through /admin/enrollments. The course then appears in the learner’s dashboard and progress works as before.

The page does not create a purchase, make a payment request, poll a payment provider or unlock lessons automatically. Copying text is a local action; it does not send a message. Free courses and existing enrollments keep their earlier flow. Historical paid orders remain readable; pending-order actions now point to direct contact.

## Add the owner’s details when supplied

Edit apps/web/src/content/enrollment-contact.json. All four fields are currently empty on purpose:

```json
{
  "zaloQrImage": "",
  "zaloUrl": "",
  "phone": "",
  "email": ""
}
```

- Put the real contact QR image under apps/web/public/images/ and set zaloQrImage to its public path, such as /images/zalo-contact.png. PNG/JPEG/WebP are supported. The image should already contain its QR quiet zone; the page provides a white backing.
- Set zaloUrl to the actual https://zalo.me/ profile link supplied by the owner.
- Set phone/email only to the owner’s intended public contact details. They become tel/mailto links.
- These are public contact settings, not authentication credentials. Do not store secrets here.
- Rebuild the frontend after changing this file. No database migration or payment-provider configuration is needed.

An empty configuration renders a clear “QR Zalo đang được cập nhật” placeholder, no QR pattern and no fake destinations. If some channels are supplied, only those channels are shown.

## Technical notes

The existing checkout URL is retained, with its page moved from the protected learner layout to the public marketing layout. The proxy’s catalog-resource mapping checks public course visibility for this route before the normal session requirement; other account and learner routes stay protected. The paid CTA no longer imports the legacy CheckoutPanel or posts to the checkout API. The old payment engine remains for historical records and is not used by this enrollment flow.

Verification: optimized frontend build and TypeScript pass; all 196 frontend tests pass. The browser regression specification now covers public direct contact without online checkout requests and preserves the paid-lesson access restriction. The full browser-test runner was not rerun; local browser checks cover the changed enrollment journey.

Verified locally in the browser: a logged-out visitor follows a paid-course CTA to the contact page; the selected title/slug are preserved; copying the message succeeds; VI/EN copy and a 390px phone viewport work without horizontal overflow. A seeded enrolled learner still receives Continue learning. Opening a free course through the old checkout URL redirects to its course page. A missing paid-course slug returns 404, and /my-courses still redirects anonymous visitors to login. Screenshots are saved under screenshots/direct-enrollment-desktop.png and screenshots/direct-enrollment-phone.png.
